# Hidden Hand Duel

Hidden Hand Duel is a browser-based 1v1 psychological strategy game combining Rock-Paper-Scissors and tactical cards.

## Play Online
After GitHub Pages is enabled:

- https://dic19milliq.github.io/hidden-hand-duel/

## Features
- 1P vs CPU / Local 2P
- Simultaneous hidden set (RPS + 1 card if available)
- Tie loop: cards stay locked, RPS is replayed
- Two-step reveal: RPS first, then card effect resolution
- Public deck/discard information for prediction play

## Current Rule Set
- Starting HP: 4
- Starting hand: 3
- Max hand: 5
- Shared deck: 14 cards
- Card set rule: if hand has cards, set exactly 1 card each round (only hand 0 can set none)
- Draw rule: player who **takes damage** draws 1 card (unless blocked by card effects)
- Special draw: if a player starts a round at HP 1 with 0 cards in hand and wins RPS without setting a card, they draw 2 cards

### Card List
- Attack
  - 渾身の一撃 x2: RPS勝利時、追加で1ダメージ
  - 貫通打 x2: RPS勝利時、相手カード効果を無視
  - 手札崩し x1: RPS勝利時、相手手札をランダム1枚捨てる
- Defense
  - 完全防御 x2: RPS敗北時、被ダメージを0にする
  - 切り返し x1: RPS敗北時、被ダメージを1減らし相手に1反撃（あいこ発生ラウンドは無効）
  - 崩し返し x1: RPS敗北時、相手手札をランダム1枚捨てる
- Strategy
  - 補給封じ x1: 相手の被ダメージドローを無効化
  - 戦利品 x2: 自分が勝利時、相手手札からランダム1枚奪う
  - 活力転化 x2: RPS勝利時、自分のHPを1回復（最大4）

## Local Run
No build tools required.

1. Open `index.html` in your browser
2. Start playing

## Project Structure
- `index.html`: UI skeleton
- `style.css`: styling
- `game.js`: game loop and UI wiring
- `cards.js`: card definitions and effect resolution
- `ai.js`: CPU decision logic

## License
MIT License
