(() => {
  const CARD_TYPES = {
    ATTACK: "attack",
    DEFENSE: "defense",
    STRATEGY: "strategy"
  };

  const TYPE_LABELS_JA = {
    [CARD_TYPES.ATTACK]: "攻撃",
    [CARD_TYPES.DEFENSE]: "防御",
    [CARD_TYPES.STRATEGY]: "戦略"
  };

  function removeRandomHandCard(state, owner, ctx, reasonLabel) {
    const player = state.players[owner];
    const lockedId = ctx.playedCards[owner] ? ctx.playedCards[owner].id : null;
    const candidates = player.hand.filter((card) => card.id !== lockedId);
    if (!candidates.length) {
      ctx.notes.push(`${player.name}の手札は空のため${reasonLabel}は不発。`);
      return false;
    }

    const picked = candidates[Math.floor(Math.random() * candidates.length)];
    player.hand = player.hand.filter((card) => card.id !== picked.id);
    state.discard.push(picked);
    ctx.notes.push(`${player.name}の手札1枚が捨てられた。`);
    return true;
  }

  const CARD_TEMPLATES = [
    {
      key: "power_strike",
      nameJa: "渾身の一撃",
      type: CARD_TYPES.ATTACK,
      trigger: "win",
      copies: 2,
      descriptionJa: "じゃんけん勝利時、追加で1ダメージを与える。",
      effect(state, ctx, owner) {
        if (ctx.outcomes[owner] !== "win") {
          return;
        }
        ctx.damageTo[1 - owner] += 1;
        ctx.notes.push(`${state.players[owner].name}の渾身の一撃で追加1ダメージ。`);
      }
    },
    {
      key: "piercing_blow",
      nameJa: "貫通打",
      type: CARD_TYPES.ATTACK,
      trigger: "win",
      copies: 2,
      descriptionJa: "じゃんけん勝利時、相手カード効果を無視する。",
      effect(state, ctx, owner) {
        if (ctx.outcomes[owner] !== "win") {
          return;
        }
        ctx.notes.push(`${state.players[owner].name}の貫通打が相手効果を貫通。`);
      }
    },
    {
      key: "hand_break",
      nameJa: "手札崩し",
      type: CARD_TYPES.ATTACK,
      trigger: "win",
      copies: 1,
      descriptionJa: "じゃんけん勝利時、相手手札をランダム1枚捨てる。",
      effect(state, ctx, owner) {
        if (ctx.outcomes[owner] !== "win") {
          return;
        }
        removeRandomHandCard(state, 1 - owner, ctx, "手札崩し");
      }
    },
    {
      key: "guard",
      nameJa: "完全防御",
      type: CARD_TYPES.DEFENSE,
      trigger: "loss",
      copies: 2,
      descriptionJa: "じゃんけん敗北時、受けるダメージを0にする。",
      effect(state, ctx, owner) {
        if (ctx.outcomes[owner] !== "loss") {
          return;
        }
        ctx.damageTo[owner] = 0;
        ctx.notes.push(`${state.players[owner].name}の完全防御で被ダメージ無効。`);
      }
    },
    {
      key: "reversal",
      nameJa: "切り返し",
      type: CARD_TYPES.DEFENSE,
      trigger: "loss",
      copies: 2,
      descriptionJa: "じゃんけん敗北時、被ダメージを1減らし相手に1反撃。",
      effect(state, ctx, owner) {
        if (ctx.outcomes[owner] !== "loss") {
          return;
        }
        const opponent = 1 - owner;
        ctx.damageTo[owner] = Math.max(0, ctx.damageTo[owner] - 1);
        ctx.damageTo[opponent] += 1;
        ctx.notes.push(`${state.players[owner].name}の切り返しで反撃1ダメージ。`);
      }
    },
    {
      key: "counter_break",
      nameJa: "崩し返し",
      type: CARD_TYPES.DEFENSE,
      trigger: "loss",
      copies: 1,
      descriptionJa: "じゃんけん敗北時、相手手札をランダム1枚捨てる。",
      effect(state, ctx, owner) {
        if (ctx.outcomes[owner] !== "loss") {
          return;
        }
        removeRandomHandCard(state, 1 - owner, ctx, "崩し返し");
      }
    },
    {
      key: "supply_lock",
      nameJa: "補給封じ",
      type: CARD_TYPES.STRATEGY,
      trigger: "any",
      copies: 2,
      descriptionJa: "このラウンド、相手の被ダメージドローを無効化する。",
      effect(state, ctx, owner) {
        const opponent = 1 - owner;
        ctx.drawOverrides[opponent].blockDamageDraw = true;
        ctx.notes.push(`${state.players[owner].name}が補給封じを発動。`);
      }
    },
    {
      key: "plunder",
      nameJa: "戦利品",
      type: CARD_TYPES.STRATEGY,
      trigger: "win",
      copies: 2,
      descriptionJa: "自分が勝利時、相手手札からランダム1枚を奪う。",
      effect(state, ctx, owner) {
        if (ctx.outcomes[owner] !== "win") {
          return;
        }
        const opponent = 1 - owner;
        const lockedId = ctx.playedCards[opponent] ? ctx.playedCards[opponent].id : null;
        const candidates = state.players[opponent].hand.filter((card) => card.id !== lockedId);
        if (!candidates.length) {
          ctx.notes.push(`${state.players[owner].name}の戦利品は不発（相手手札なし）。`);
          return;
        }
        const picked = candidates[Math.floor(Math.random() * candidates.length)];
        state.players[opponent].hand = state.players[opponent].hand.filter((card) => card.id !== picked.id);
        state.players[owner].hand.push(picked);
        ctx.notes.push(`${state.players[owner].name}が戦利品で相手手札1枚を奪取。`);
      }
    }
  ];

  function cloneTemplate(template, copyIndex) {
    return {
      id: `${template.key}_${copyIndex}`,
      key: template.key,
      nameJa: template.nameJa,
      name: template.nameJa,
      type: template.type,
      trigger: template.trigger,
      descriptionJa: template.descriptionJa,
      description: template.descriptionJa,
      effect: template.effect
    };
  }

  function createInitialDeck() {
    const deck = [];
    CARD_TEMPLATES.forEach((template) => {
      const copies = template.copies || 1;
      for (let i = 1; i <= copies; i += 1) {
        deck.push(cloneTemplate(template, i));
      }
    });

    for (let i = deck.length - 1; i > 0; i -= 1) {
      const j = Math.floor(Math.random() * (i + 1));
      [deck[i], deck[j]] = [deck[j], deck[i]];
    }

    return deck;
  }

  function getPlayableCards(player) {
    return player.hand.slice();
  }

  function getCardCatalog() {
    return CARD_TEMPLATES.map((template) => ({
      key: template.key,
      nameJa: template.nameJa,
      type: template.type,
      typeLabel: TYPE_LABELS_JA[template.type],
      descriptionJa: template.descriptionJa,
      copies: template.copies || 1
    }));
  }

  function resolveCardEffects(state, context) {
    const ctx = {
      outcomes: context.outcomes,
      playedCards: context.playedCards,
      damageTo: context.damageTo,
      notes: [],
      ignoredCards: [false, false],
      drawOverrides: context.drawOverrides
    };

    for (let p = 0; p < 2; p += 1) {
      const card = ctx.playedCards[p];
      if (card && card.key === "piercing_blow" && ctx.outcomes[p] === "win") {
        ctx.ignoredCards[1 - p] = true;
      }
    }

    const phaseOrder = [CARD_TYPES.DEFENSE, CARD_TYPES.ATTACK, CARD_TYPES.STRATEGY];
    phaseOrder.forEach((phase) => {
      for (let p = 0; p < 2; p += 1) {
        const card = ctx.playedCards[p];
        if (!card || card.type !== phase) {
          continue;
        }
        if (ctx.ignoredCards[p]) {
          ctx.notes.push(`${state.players[p].name}の${card.nameJa}は無効化された。`);
          continue;
        }
        card.effect(state, ctx, p);
      }
    });

    return {
      damageTo: ctx.damageTo,
      notes: ctx.notes,
      ignoredCards: ctx.ignoredCards,
      drawOverrides: ctx.drawOverrides
    };
  }

  window.HiddenHandCards = {
    CARD_TYPES,
    TYPE_LABELS_JA,
    createInitialDeck,
    getPlayableCards,
    getCardCatalog,
    resolveCardEffects
  };
})();

