(() => {
  const MAX_HAND = 4;
  const START_HP = 4;
  const START_HAND_SIZE = 3;

  const HAND_LABEL_JA = {
    rock: "グー",
    paper: "パー",
    scissors: "チョキ"
  };

  const HAND_ICON = {
    rock: "✊",
    paper: "✋",
    scissors: "✌"
  };

  const OUTCOME_LABEL_JA = {
    win: "勝ち",
    loss: "負け",
    tie: "あいこ"
  };

  const BEATS = {
    rock: "scissors",
    paper: "rock",
    scissors: "paper"
  };

  let state = null;
  const el = {};

  document.addEventListener("DOMContentLoaded", () => {
    bindElements();
    bindEvents();
    renderInitial();
  });

  function bindElements() {
    el.modeSelect = document.getElementById("modeSelect");
    el.gameBoard = document.getElementById("gameBoard");
    el.modeCpuBtn = document.getElementById("modeCpuBtn");
    el.modeLocalBtn = document.getElementById("modeLocalBtn");
    el.roundLabel = document.getElementById("roundLabel");
    el.turnLabel = document.getElementById("turnLabel");
    el.p1Name = document.getElementById("p1Name");
    el.p2Name = document.getElementById("p2Name");
    el.p1Hp = document.getElementById("p1Hp");
    el.p2Hp = document.getElementById("p2Hp");
    el.p1HandCount = document.getElementById("p1HandCount");
    el.p2HandCount = document.getElementById("p2HandCount");
    el.deckSize = document.getElementById("deckSize");
    el.discardText = document.getElementById("discardText");
    el.privateInfo = document.getElementById("privateInfo");
    el.cardSelect = document.getElementById("cardSelect");
    el.cardHint = document.getElementById("cardHint");
    el.confirmBtn = document.getElementById("confirmBtn");
    el.revealPanel = document.getElementById("revealPanel");
    el.revealEffectsBtn = document.getElementById("revealEffectsBtn");
    el.revealText = document.getElementById("revealText");
    el.resolutionSummary = document.getElementById("resolutionSummary");
    el.logList = document.getElementById("logList");
    el.cardCatalog = document.getElementById("cardCatalog");
    el.restartBtn = document.getElementById("restartBtn");
    el.maskOverlay = document.getElementById("maskOverlay");
    el.maskText = document.getElementById("maskText");
    el.maskContinueBtn = document.getElementById("maskContinueBtn");
  }

  function bindEvents() {
    el.modeCpuBtn.addEventListener("click", () => {
      state = initGame("cpu");
      render();
    });

    el.modeLocalBtn.addEventListener("click", () => {
      state = initGame("local2p");
      render();
    });

    el.confirmBtn.addEventListener("click", onConfirmSelection);
    el.revealEffectsBtn.addEventListener("click", onRevealEffects);
    el.cardSelect.addEventListener("change", onCardPreview);
    el.restartBtn.addEventListener("click", onRestart);
    el.maskContinueBtn.addEventListener("click", onMaskContinue);
  }

  function renderInitial() {
    el.modeSelect.classList.remove("hidden");
    el.gameBoard.classList.add("hidden");
  }

  function createPlayer(name) {
    return {
      name,
      hp: START_HP,
      hand: [],
      lastRps: null,
      lastOutcome: null
    };
  }

  function drawFromTop(currentState, playerId) {
    if (!currentState.deck.length) {
      return null;
    }
    const card = currentState.deck.shift();
    currentState.players[playerId].hand.push(card);
    return card;
  }

  function initGame(mode) {
    const players = [
      createPlayer("プレイヤー1"),
      createPlayer(mode === "cpu" ? "CPU" : "プレイヤー2")
    ];

    const gameState = {
      mode,
      round: 1,
      players,
      deck: window.HiddenHandCards.createInitialDeck(),
      discard: [],
      pendingSelections: [null, null],
      pendingRound: null,
      roundPhase: "set",
      log: ["ゲーム開始。"],
      reveal: null,
      gameOver: false,
      winner: null,
      activePlayer: 0
    };

    for (let i = 0; i < START_HAND_SIZE; i += 1) {
      drawFromTop(gameState, 0);
      drawFromTop(gameState, 1);
    }

    return gameState;
  }

  function getOutcome(p1, p2) {
    if (p1 === p2) {
      return ["tie", "tie"];
    }
    if (BEATS[p1] === p2) {
      return ["win", "loss"];
    }
    return ["loss", "win"];
  }

  function getDisplayIndices() {
    return [1, 0];
  }

  function focusRevealPanel() {
    if (!el.revealPanel) {
      return;
    }
    el.revealPanel.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  function submitSelection(playerId, selection) {
    if (!state || state.gameOver) {
      return false;
    }
    if (!["rock", "paper", "scissors"].includes(selection.rps)) {
      return false;
    }

    state.pendingSelections[playerId] = {
      rps: selection.rps,
      cardId: selection.cardId || null
    };
    return true;
  }

  function getCardInHand(player, cardId) {
    if (!cardId) {
      return null;
    }
    return player.hand.find((card) => card.id === cardId) || null;
  }

  function drawByOutcome(currentState, playerId, damageTaken, drawOverride) {
    let canDraw = damageTaken > 0;
    if (drawOverride.blockDamageDraw && canDraw) {
      canDraw = false;
    }

    if (!canDraw) {
      return { success: false, skipped: true, reason: "ドロー条件を満たさない。" };
    }

    if (currentState.players[playerId].hand.length >= MAX_HAND) {
      return { success: false, reason: "手札上限のためドロー不可。" };
    }

    const drawn = drawFromTop(currentState, playerId);
    if (!drawn) {
      return { success: false, reason: "山札切れでドロー不可。" };
    }

    return { success: true };
  }

  function removePlayedCards(currentState, playedCards) {
    for (let p = 0; p < 2; p += 1) {
      const card = playedCards[p];
      if (!card) {
        continue;
      }
      currentState.players[p].hand = currentState.players[p].hand.filter((c) => c.id !== card.id);
      currentState.discard.push(card);
    }
  }

  function startRpsReveal(currentState) {
    const s0 = currentState.pendingSelections[0];
    const s1 = currentState.pendingSelections[1];
    if (!s0 || !s1) {
      return null;
    }

    if (!currentState.pendingRound) {
      currentState.pendingRound = {
        lockedCardIds: [s0.cardId || null, s1.cardId || null],
        tieCount: 0,
        latestSelections: null,
        outcomes: null,
        baseDamage: null
      };
    }

    const outcomes = getOutcome(s0.rps, s1.rps);
    const baseDamage = [0, 0];
    if (outcomes[0] === "win") {
      baseDamage[1] = 1;
    } else if (outcomes[1] === "win") {
      baseDamage[0] = 1;
    }

    currentState.players[0].lastRps = s0.rps;
    currentState.players[1].lastRps = s1.rps;
    currentState.players[0].lastOutcome = outcomes[0];
    currentState.players[1].lastOutcome = outcomes[1];

    currentState.pendingRound.latestSelections = [s0, s1];
    currentState.pendingRound.outcomes = outcomes;
    currentState.pendingRound.baseDamage = baseDamage;

    const [left, right] = getDisplayIndices();
    currentState.log.push(
      `ラウンド${currentState.round}: ${currentState.players[left].name} ${HAND_LABEL_JA[s1.rps]} vs ${currentState.players[right].name} ${HAND_LABEL_JA[s0.rps]}`
    );

    if (outcomes[0] === "tie") {
      currentState.pendingRound.tieCount += 1;
      currentState.roundPhase = "rps_only";
      currentState.pendingSelections = [null, null];
      currentState.reveal = {
        phase: "tie",
        selections: [s0, s1],
        outcomes,
        tieCount: currentState.pendingRound.tieCount
      };
      currentState.log.push("あいこ。カードを保持したまま再じゃんけん。");
      return currentState.reveal;
    }

    currentState.roundPhase = "rps_revealed";
    currentState.reveal = {
      phase: "rps",
      selections: [s0, s1],
      outcomes,
      tieCount: currentState.pendingRound.tieCount
    };

    return currentState.reveal;
  }

  function resolvePendingEffects(currentState) {
    if (!currentState.pendingRound || currentState.roundPhase !== "rps_revealed") {
      return null;
    }

    const selections = currentState.pendingRound.latestSelections;
    const outcomes = currentState.pendingRound.outcomes;
    const baseDamage = [...currentState.pendingRound.baseDamage];

    const hpBefore = [currentState.players[0].hp, currentState.players[1].hp];

    const playedCards = [
      getCardInHand(currentState.players[0], currentState.pendingRound.lockedCardIds[0]),
      getCardInHand(currentState.players[1], currentState.pendingRound.lockedCardIds[1])
    ];

    const drawOverrides = [
      { blockDamageDraw: false },
      { blockDamageDraw: false }
    ];

    const cardResult = window.HiddenHandCards.resolveCardEffects(currentState, {
      outcomes,
      playedCards,
      damageTo: baseDamage,
      drawOverrides
    });

    currentState.players[0].hp = Math.max(0, currentState.players[0].hp - cardResult.damageTo[0]);
    currentState.players[1].hp = Math.max(0, currentState.players[1].hp - cardResult.damageTo[1]);

    const drawResults = [
      drawByOutcome(currentState, 0, cardResult.damageTo[0], cardResult.drawOverrides[0]),
      drawByOutcome(currentState, 1, cardResult.damageTo[1], cardResult.drawOverrides[1])
    ];

    removePlayedCards(currentState, playedCards);

    currentState.reveal = {
      phase: "resolved",
      selections,
      outcomes,
      cards: [playedCards[0] ? playedCards[0].nameJa : "なし", playedCards[1] ? playedCards[1].nameJa : "なし"],
      damageTo: cardResult.damageTo,
      tieCount: currentState.pendingRound.tieCount,
      summary: {
        hpBefore,
        hpAfter: [currentState.players[0].hp, currentState.players[1].hp],
        effectNotes: cardResult.notes,
        drawResults
      }
    };

    cardResult.notes.forEach((note) => currentState.log.push(note));
    drawResults.forEach((res, idx) => {
      const playerName = currentState.players[idx].name;
      if (res.success) {
        currentState.log.push(`${playerName}はドロー成功。`);
      } else if (!res.skipped) {
        currentState.log.push(`${playerName}のドロー失敗: ${res.reason}`);
      }
    });

    if (currentState.players[0].hp <= 0 || currentState.players[1].hp <= 0) {
      currentState.gameOver = true;
      if (currentState.players[0].hp === currentState.players[1].hp) {
        currentState.winner = "引き分け";
      } else {
        currentState.winner = currentState.players[0].hp > 0
          ? currentState.players[0].name
          : currentState.players[1].name;
      }
      currentState.log.push(`ゲーム終了。勝者: ${currentState.winner}`);
    }

    currentState.pendingSelections = [null, null];
    currentState.pendingRound = null;
    currentState.roundPhase = "set";
    currentState.round += 1;

    return currentState.reveal;
  }

  function resolveRound(currentState) {
    return startRpsReveal(currentState);
  }

  function getCurrentInputPlayerId() {
    return state.mode === "cpu" ? 0 : state.activePlayer;
  }

  function onCardPreview() {
    if (!state) {
      return;
    }
    const player = state.players[getCurrentInputPlayerId()];
    const selectedId = el.cardSelect.value;
    const card = player.hand.find((c) => c.id === selectedId);
    el.cardHint.textContent = card ? card.descriptionJa : "";
  }

  function readCurrentCardSelection() {
    if (state.roundPhase !== "set") {
      return null;
    }
    return el.cardSelect.value || null;
  }

  function handleAfterBothSelected() {
    resolveRound(state);
    state.activePlayer = 0;
    clearSelectionInputs();
    render();
    focusRevealPanel();
  }

  function onConfirmSelection() {
    if (!state || state.gameOver || !["set", "rps_only"].includes(state.roundPhase)) {
      return;
    }

    const selectedRps = document.querySelector('input[name="rps"]:checked');
    if (!selectedRps) {
      state.log.push("じゃんけん（グー/パー/チョキ）を選択してください。");
      render();
      return;
    }

    const playerId = getCurrentInputPlayerId();
    submitSelection(playerId, {
      rps: selectedRps.value,
      cardId: readCurrentCardSelection()
    });

    if (state.mode === "cpu") {
      const cpuAction = window.HiddenHandAI.chooseCpuAction(state, 1);
      submitSelection(1, { rps: cpuAction.rps, cardId: cpuAction.cardId });
      handleAfterBothSelected();
      return;
    }

    if (state.activePlayer === 0) {
      state.activePlayer = 1;
      showMask("プレイヤー2の入力に切り替えます。周囲に見えない状態で続けてください。");
      clearSelectionInputs();
      render();
      return;
    }

    handleAfterBothSelected();
  }

  function onRevealEffects() {
    if (!state || state.gameOver || state.roundPhase !== "rps_revealed") {
      return;
    }
    resolvePendingEffects(state);
    render();
    focusRevealPanel();
  }

  function clearSelectionInputs() {
    const checked = document.querySelector('input[name="rps"]:checked');
    if (checked) {
      checked.checked = false;
    }
    el.cardSelect.selectedIndex = 0;
    el.cardHint.textContent = "";
  }

  function onRestart() {
    if (!state) {
      return;
    }
    state = initGame(state.mode);
    hideMask();
    clearSelectionInputs();
    render();
  }

  function showMask(text) {
    el.maskText.textContent = text;
    el.maskOverlay.classList.remove("hidden");
  }

  function hideMask() {
    el.maskOverlay.classList.add("hidden");
  }

  function onMaskContinue() {
    hideMask();
    render();
  }

  function updateCardSelect() {
    const player = state.players[getCurrentInputPlayerId()];

    if (state.roundPhase === "rps_only") {
      const locked = state.pendingRound ? state.pendingRound.lockedCardIds[getCurrentInputPlayerId()] : null;
      const lockedCard = getCardInHand(player, locked);
      const label = lockedCard ? `${lockedCard.nameJa} [${window.HiddenHandCards.TYPE_LABELS_JA[lockedCard.type]}]` : "出さない";
      el.cardSelect.innerHTML = `<option>${label}</option>`;
      el.cardHint.textContent = "あいこ中はカード固定。じゃんけんのみ再選択。";
      return;
    }

    const cards = window.HiddenHandCards.getPlayableCards(player, state);
    const options = ['<option value="">出さない</option>'];
    cards.forEach((card) => {
      const typeLabel = window.HiddenHandCards.TYPE_LABELS_JA[card.type];
      options.push(`<option value="${card.id}">${card.nameJa} [${typeLabel}]</option>`);
    });
    el.cardSelect.innerHTML = options.join("");
    el.cardHint.textContent = "";
  }

  function renderCardCatalog() {
    const catalog = window.HiddenHandCards.getCardCatalog();
    el.cardCatalog.innerHTML = catalog
      .map((item) => `<li><strong>${item.nameJa}</strong>（${item.typeLabel}）x${item.copies}: ${item.descriptionJa}</li>`)
      .join("");
  }

  function renderRevealLane(name, rps, outcome, extra) {
    const badgeClass = outcome === "win" ? "badge-win" : outcome === "loss" ? "badge-loss" : "badge-tie";
    return `
      <div class="reveal-lane">
        <div class="lane-name">${name}</div>
        <div class="lane-hand">${HAND_ICON[rps]}</div>
        <div class="lane-label">${HAND_LABEL_JA[rps]}</div>
        <div class="outcome-badge ${badgeClass}">${OUTCOME_LABEL_JA[outcome]}</div>
        ${extra ? `<div class="lane-extra">${extra}</div>` : ""}
      </div>
    `;
  }

  function renderReveal() {
    if (!state.reveal) {
      el.revealText.textContent = "まだラウンドは開始していません。";
      return;
    }

    const [left, right] = getDisplayIndices();
    const leftName = state.players[left].name;
    const rightName = state.players[right].name;
    const leftSel = state.reveal.selections[left];
    const rightSel = state.reveal.selections[right];

    const leftExtra = state.reveal.phase === "resolved"
      ? `カード: ${state.reveal.cards[left]} / 被ダメージ: ${state.reveal.damageTo[left]}`
      : "";
    const rightExtra = state.reveal.phase === "resolved"
      ? `カード: ${state.reveal.cards[right]} / 被ダメージ: ${state.reveal.damageTo[right]}`
      : "";

    let header = "じゃんけん公開";
    if (state.reveal.phase === "tie") {
      header = `あいこ（${state.reveal.tieCount}回目）: もう一度じゃんけん`;
    } else if (state.reveal.phase === "resolved") {
      header = "カード効果解決済み";
    }

    const html = `
      <div class="reveal-wrap">
        <div class="reveal-head">${header}</div>
        <div class="reveal-grid">
          ${renderRevealLane(leftName, leftSel.rps, state.reveal.outcomes[left], leftExtra)}
          ${renderRevealLane(rightName, rightSel.rps, state.reveal.outcomes[right], rightExtra)}
        </div>
      </div>
    `;

    el.revealText.innerHTML = html;
  }

  function renderResolutionSummary() {
    if (!state.reveal || state.reveal.phase !== "resolved" || !state.reveal.summary) {
      el.resolutionSummary.classList.add("hidden");
      el.resolutionSummary.innerHTML = "";
      return;
    }

    const [left, right] = getDisplayIndices();
    const leftName = state.players[left].name;
    const rightName = state.players[right].name;
    const s = state.reveal.summary;

    const drawLine = [left, right].map((idx) => {
      const result = s.drawResults[idx];
      if (result.success) {
        return `${state.players[idx].name}: ドロー成功`;
      }
      if (result.skipped) {
        return `${state.players[idx].name}: ドローなし`;
      }
      return `${state.players[idx].name}: ドロー失敗`;
    }).join(" / ");

    const effectItems = s.effectNotes.length
      ? s.effectNotes.map((note) => `<li>${note}</li>`).join("")
      : "<li>効果発動なし</li>";

    el.resolutionSummary.classList.remove("hidden");
    el.resolutionSummary.innerHTML = `
      <div class="summary-title">解決サマリー</div>
      <ul class="summary-list">
        <li>${leftName} HP: ${s.hpBefore[left]} -> ${s.hpAfter[left]} / ${rightName} HP: ${s.hpBefore[right]} -> ${s.hpAfter[right]}</li>
        <li>${drawLine}</li>
      </ul>
      <div class="summary-title">発動したカード効果</div>
      <ul class="summary-list">${effectItems}</ul>
    `;
  }

  function renderPrivateInfo() {
    if (!state) {
      return;
    }

    if (state.roundPhase === "rps_only" && state.pendingRound) {
      const playerId = getCurrentInputPlayerId();
      const lockedId = state.pendingRound.lockedCardIds[playerId];
      const card = getCardInHand(state.players[playerId], lockedId);
      const msg = card
        ? `このラウンドのセットカード: ${card.nameJa}`
        : "このラウンドはカード未セット。";
      el.privateInfo.classList.remove("hidden");
      el.privateInfo.textContent = msg;
      return;
    }

    el.privateInfo.classList.add("hidden");
    el.privateInfo.textContent = "";
  }

  function renderLog() {
    el.logList.innerHTML = state.log
      .slice()
      .reverse()
      .map((line) => `<li>${line}</li>`)
      .join("");
  }

  function render() {
    if (!state) {
      renderInitial();
      return;
    }

    el.modeSelect.classList.add("hidden");
    el.gameBoard.classList.remove("hidden");

    el.p1Name.textContent = state.players[0].name;
    el.p2Name.textContent = state.players[1].name;
    el.p1Hp.textContent = String(state.players[0].hp);
    el.p2Hp.textContent = String(state.players[1].hp);
    el.p1HandCount.textContent = String(state.players[0].hand.length);
    el.p2HandCount.textContent = String(state.players[1].hand.length);
    el.deckSize.textContent = String(state.deck.length);
    el.roundLabel.textContent = `ラウンド: ${state.round}`;

    if (state.gameOver) {
      el.turnLabel.textContent = "ゲーム終了";
    } else if (state.roundPhase === "rps_revealed") {
      el.turnLabel.textContent = "じゃんけん決着。下のボタンでカード効果を解決。";
    } else if (state.roundPhase === "rps_only") {
      el.turnLabel.textContent = "あいこ。カード保持で再じゃんけん。";
    } else if (state.mode === "cpu") {
      el.turnLabel.textContent = "あなたの入力";
    } else {
      const t = state.activePlayer === 0 ? "プレイヤー1" : "プレイヤー2";
      el.turnLabel.textContent = `${t}の入力`;
    }

    if (state.discard.length) {
      el.discardText.textContent = state.discard.map((card) => card.nameJa).join("、");
    } else {
      el.discardText.textContent = "なし";
    }

    updateCardSelect();
    renderCardCatalog();
    renderPrivateInfo();
    renderReveal();
    renderResolutionSummary();
    renderLog();

    const maskShown = !el.maskOverlay.classList.contains("hidden");
    const inputLocked = state.gameOver || maskShown || state.roundPhase === "rps_revealed";

    const rpsInputs = document.querySelectorAll('input[name="rps"]');
    rpsInputs.forEach((input) => {
      input.disabled = inputLocked;
    });

    el.cardSelect.disabled = inputLocked || state.roundPhase === "rps_only";
    el.confirmBtn.disabled = inputLocked;
    el.revealEffectsBtn.disabled = state.gameOver || state.roundPhase !== "rps_revealed" || maskShown;
    el.revealEffectsBtn.textContent = state.roundPhase === "rps_revealed"
      ? "ここでカード効果を公開して解決"
      : "カード効果を公開して解決";
  }

  window.initGame = initGame;
  window.submitSelection = submitSelection;
  window.resolveRound = resolveRound;
  window.drawByOutcome = drawByOutcome;
})();

