(() => {
  const HANDS = ["rock", "paper", "scissors"];
  const BEATS = {
    rock: "scissors",
    paper: "rock",
    scissors: "paper"
  };

  function weightedChoice(weights) {
    const total = Object.values(weights).reduce((sum, w) => sum + w, 0);
    const r = Math.random() * total;
    let acc = 0;
    for (const hand of HANDS) {
      acc += weights[hand];
      if (r <= acc) {
        return hand;
      }
    }
    return HANDS[Math.floor(Math.random() * HANDS.length)];
  }

  function handThatBeats(hand) {
    return Object.keys(BEATS).find((key) => BEATS[key] === hand) || "rock";
  }

  function predictOutcome(myHand, oppHand) {
    if (myHand === oppHand) {
      return "tie";
    }
    return BEATS[myHand] === oppHand ? "win" : "loss";
  }

  function chooseCardByHeuristic(state, cpuId, predictedOutcome) {
    const cpu = state.players[cpuId];
    const cards = cpu.hand;
    const types = window.HiddenHandCards.CARD_TYPES;

    const attack = cards.find((card) => card.type === types.ATTACK);
    const defense = cards.find((card) => card.type === types.DEFENSE);
    const strategy = cards.find((card) => card.type === types.STRATEGY);

    if (predictedOutcome === "win" && attack && Math.random() < 0.7) {
      return attack.id;
    }

    if ((predictedOutcome === "loss" || cpu.hp <= 1) && defense && Math.random() < 0.8) {
      return defense.id;
    }

    if (strategy && Math.random() < 0.35) {
      return strategy.id;
    }

    return null;
  }

  function chooseCpuAction(state, cpuId) {
    const cpu = state.players[cpuId];
    const opp = state.players[1 - cpuId];

    const weights = { rock: 1, paper: 1, scissors: 1 };
    if (cpu.lastOutcome === "loss" && opp.lastRps) {
      const counter = handThatBeats(opp.lastRps);
      weights[counter] += 0.6;
    }

    const chosenRps = weightedChoice(weights);

    let predictedOpp = opp.lastRps;
    if (!predictedOpp) {
      predictedOpp = HANDS[Math.floor(Math.random() * HANDS.length)];
    }

    const predictedOutcome = predictOutcome(chosenRps, predictedOpp);
    const cardId = chooseCardByHeuristic(state, cpuId, predictedOutcome);

    return {
      rps: chosenRps,
      cardId
    };
  }

  window.HiddenHandAI = {
    chooseCpuAction
  };
})();
