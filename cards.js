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

  function pushEvent(ctx, event) {
    ctx.events.push({
      phase: event.phase || "system",
      actor: event.actor || null,
      target: event.target || null,
      card: event.card || null,
      resultType: event.resultType || "info",
      delta: event.delta || {},
      message: event.message || ""
    });
  }

  function removeRandomHandCard(state, owner, ctx, reasonLabel) {
    const player = state.players[owner];
    const lockedId = ctx.playedCards[owner] ? ctx.playedCards[owner].id : null;
    const candidates = player.hand.filter((card) => card.id !== lockedId);
    if (!candidates.length) {
      ctx.notes.push(`${player.name}の手札は空のため${reasonLabel}は不発。`);
      return { success: false, reason: "empty_hand" };
    }

    const picked = candidates[Math.floor(Math.random() * candidates.length)];
    player.hand = player.hand.filter((card) => card.id !== picked.id);
    state.discard.push(picked);
    ctx.notes.push(`${player.name}の手札1枚が捨てられた。`);
    return { success: true, card: picked };
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
        const actor = state.players[owner].name;
        const target = state.players[1 - owner].name;
        if (ctx.outcomes[owner] !== "win") {
          pushEvent(ctx, {
            phase: CARD_TYPES.ATTACK,
            actor,
            target,
            card: "渾身の一撃",
            resultType: "not_triggered",
            message: "勝利していないため不発"
          });
          return;
        }
        ctx.damageTo[1 - owner] += 1;
        ctx.notes.push(`${actor}の渾身の一撃で追加1ダメージ。`);
        pushEvent(ctx, {
          phase: CARD_TYPES.ATTACK,
          actor,
          target,
          card: "渾身の一撃",
          resultType: "success",
          delta: { damageToTarget: 1 },
          message: "追加1ダメージ"
        });
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
        const actor = state.players[owner].name;
        const target = state.players[1 - owner].name;
        if (ctx.outcomes[owner] !== "win") {
          pushEvent(ctx, {
            phase: CARD_TYPES.ATTACK,
            actor,
            target,
            card: "貫通打",
            resultType: "not_triggered",
            message: "勝利していないため不発"
          });
          return;
        }
        ctx.notes.push(`${actor}の貫通打が相手効果を貫通。`);
        pushEvent(ctx, {
          phase: CARD_TYPES.ATTACK,
          actor,
          target,
          card: "貫通打",
          resultType: "success",
          message: "相手カード効果を無視"
        });
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
        const actor = state.players[owner].name;
        const target = state.players[1 - owner].name;
        if (ctx.outcomes[owner] !== "win") {
          pushEvent(ctx, {
            phase: CARD_TYPES.ATTACK,
            actor,
            target,
            card: "手札崩し",
            resultType: "not_triggered",
            message: "勝利していないため不発"
          });
          return;
        }
        const removed = removeRandomHandCard(state, 1 - owner, ctx, "手札崩し");
        if (!removed.success) {
          pushEvent(ctx, {
            phase: CARD_TYPES.ATTACK,
            actor,
            target,
            card: "手札崩し",
            resultType: "no_effect",
            message: "相手手札がないため不発"
          });
          return;
        }
        pushEvent(ctx, {
          phase: CARD_TYPES.ATTACK,
          actor,
          target,
          card: "手札崩し",
          resultType: "success",
          delta: { opponentDiscard: 1 },
          message: "相手手札を1枚破棄"
        });
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
        const actor = state.players[owner].name;
        if (ctx.outcomes[owner] !== "loss") {
          pushEvent(ctx, {
            phase: CARD_TYPES.DEFENSE,
            actor,
            card: "完全防御",
            resultType: "not_triggered",
            message: "敗北していないため不発"
          });
          return;
        }
        const prevented = ctx.damageTo[owner];
        ctx.damageTo[owner] = 0;
        ctx.notes.push(`${actor}の完全防御で被ダメージ無効。`);
        pushEvent(ctx, {
          phase: CARD_TYPES.DEFENSE,
          actor,
          card: "完全防御",
          resultType: "success",
          delta: { preventedDamage: prevented },
          message: "被ダメージを0に"
        });
      }
    },
    {
      key: "reversal",
      nameJa: "切り返し",
      type: CARD_TYPES.DEFENSE,
      trigger: "loss",
      copies: 1,
      descriptionJa: "じゃんけん敗北時、被ダメージを1減らし相手に1反撃（あいこ発生ラウンドは無効）。",
      effect(state, ctx, owner) {
        const actor = state.players[owner].name;
        const target = state.players[1 - owner].name;
        if (ctx.outcomes[owner] !== "loss") {
          pushEvent(ctx, {
            phase: CARD_TYPES.DEFENSE,
            actor,
            target,
            card: "切り返し",
            resultType: "not_triggered",
            message: "敗北していないため不発"
          });
          return;
        }
        if (ctx.tieCount > 0) {
          ctx.notes.push(`${actor}の切り返しは、あいこ発生のため不発。`);
          pushEvent(ctx, {
            phase: CARD_TYPES.DEFENSE,
            actor,
            target,
            card: "切り返し",
            resultType: "no_effect",
            message: "あいこ発生ラウンドのため不発"
          });
          return;
        }
        const opponent = 1 - owner;
        const before = ctx.damageTo[owner];
        ctx.damageTo[owner] = Math.max(0, ctx.damageTo[owner] - 1);
        const reduced = before - ctx.damageTo[owner];
        ctx.damageTo[opponent] += 1;
        ctx.notes.push(`${actor}の切り返しで反撃1ダメージ。`);
        pushEvent(ctx, {
          phase: CARD_TYPES.DEFENSE,
          actor,
          target,
          card: "切り返し",
          resultType: "success",
          delta: { reducedSelfDamage: reduced, counterDamage: 1 },
          message: "被ダメ軽減 + 反撃1"
        });
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
        const actor = state.players[owner].name;
        const target = state.players[1 - owner].name;
        if (ctx.outcomes[owner] !== "loss") {
          pushEvent(ctx, {
            phase: CARD_TYPES.DEFENSE,
            actor,
            target,
            card: "崩し返し",
            resultType: "not_triggered",
            message: "敗北していないため不発"
          });
          return;
        }
        const removed = removeRandomHandCard(state, 1 - owner, ctx, "崩し返し");
        if (!removed.success) {
          pushEvent(ctx, {
            phase: CARD_TYPES.DEFENSE,
            actor,
            target,
            card: "崩し返し",
            resultType: "no_effect",
            message: "相手手札がないため不発"
          });
          return;
        }
        pushEvent(ctx, {
          phase: CARD_TYPES.DEFENSE,
          actor,
          target,
          card: "崩し返し",
          resultType: "success",
          delta: { opponentDiscard: 1 },
          message: "相手手札を1枚破棄"
        });
      }
    },
    {
      key: "supply_lock",
      nameJa: "補給封じ",
      type: CARD_TYPES.STRATEGY,
      trigger: "any",
      copies: 1,
      descriptionJa: "このラウンド、相手の被ダメージドローを無効化する。",
      effect(state, ctx, owner) {
        const actor = state.players[owner].name;
        const target = state.players[1 - owner].name;
        const opponent = 1 - owner;
        const wasBlocked = ctx.drawOverrides[opponent].blockDamageDraw;
        ctx.drawOverrides[opponent].blockDamageDraw = true;
        ctx.notes.push(`${actor}が補給封じを発動。`);
        pushEvent(ctx, {
          phase: CARD_TYPES.STRATEGY,
          actor,
          target,
          card: "補給封じ",
          resultType: wasBlocked ? "no_effect" : "success",
          message: wasBlocked ? "すでに相手ドロー封じ中" : "相手の被ダメージドローを無効化"
        });
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
        const actor = state.players[owner].name;
        const target = state.players[1 - owner].name;
        if (ctx.outcomes[owner] !== "win") {
          pushEvent(ctx, {
            phase: CARD_TYPES.STRATEGY,
            actor,
            target,
            card: "戦利品",
            resultType: "not_triggered",
            message: "勝利していないため不発"
          });
          return;
        }
        const opponent = 1 - owner;
        const lockedId = ctx.playedCards[opponent] ? ctx.playedCards[opponent].id : null;
        const candidates = state.players[opponent].hand.filter((card) => card.id !== lockedId);
        if (!candidates.length) {
          ctx.notes.push(`${actor}の戦利品は不発（相手手札なし）。`);
          pushEvent(ctx, {
            phase: CARD_TYPES.STRATEGY,
            actor,
            target,
            card: "戦利品",
            resultType: "no_effect",
            message: "相手手札がないため不発"
          });
          return;
        }
        const picked = candidates[Math.floor(Math.random() * candidates.length)];
        state.players[opponent].hand = state.players[opponent].hand.filter((card) => card.id !== picked.id);
        state.players[owner].hand.push(picked);
        ctx.notes.push(`${actor}が戦利品で相手手札1枚を奪取。`);
        pushEvent(ctx, {
          phase: CARD_TYPES.STRATEGY,
          actor,
          target,
          card: "戦利品",
          resultType: "success",
          delta: { steal: 1 },
          message: "相手手札を1枚奪取"
        });
      }
    },
    {
      key: "vital_surge",
      nameJa: "活力転化",
      type: CARD_TYPES.STRATEGY,
      trigger: "win",
      copies: 2,
      descriptionJa: "じゃんけん勝利時、自分のライフを1回復（最大4）。",
      effect(state, ctx, owner) {
        const actor = state.players[owner].name;
        if (ctx.outcomes[owner] !== "win") {
          pushEvent(ctx, {
            phase: CARD_TYPES.STRATEGY,
            actor,
            card: "活力転化",
            resultType: "not_triggered",
            message: "勝利していないため不発"
          });
          return;
        }
        const player = state.players[owner];
        const maxHp = player.maxHp || 4;
        const before = player.hp;
        player.hp = Math.min(maxHp, player.hp + 1);
        if (player.hp > before) {
          ctx.notes.push(`${player.name}の活力転化でライフ1回復。`);
          pushEvent(ctx, {
            phase: CARD_TYPES.STRATEGY,
            actor,
            card: "活力転化",
            resultType: "success",
            delta: { heal: player.hp - before },
            message: "HPを1回復"
          });
          return;
        }
        ctx.notes.push(`${player.name}の活力転化は不発（ライフ最大）。`);
        pushEvent(ctx, {
          phase: CARD_TYPES.STRATEGY,
          actor,
          card: "活力転化",
          resultType: "no_effect",
          message: "HP最大のため不発"
        });
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
      events: [],
      ignoredCards: [false, false],
      drawOverrides: context.drawOverrides,
      tieCount: context.tieCount || 0
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
          const actor = state.players[p].name;
          ctx.notes.push(`${actor}の${card.nameJa}は無効化された。`);
          pushEvent(ctx, {
            phase,
            actor,
            target: state.players[1 - p].name,
            card: card.nameJa,
            resultType: "ignored",
            message: "貫通打により無効化"
          });
          continue;
        }
        card.effect(state, ctx, p);
      }
    });

    return {
      damageTo: ctx.damageTo,
      notes: ctx.notes,
      events: ctx.events,
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
