export class GamePhase {
  constructor(
    public readonly numberOfPlayers: number,
    public readonly numberOfCards: number,
    public readonly playerIndex: number,
    public readonly highestPlayedIndex: number | null
  ) {}

  getModelName() {
    return toModelName(this.numberOfPlayers, this.numberOfCards, this.playerIndex, this.highestPlayedIndex);
  }
}

export function toModelName(
  numberOfPlayers: number,
  numberOfCards: number,
  playerIndex: number,
  highestPlayedIndex: number | null
) {
  return `${numberOfPlayers}${numberOfCards}${playerIndex}${highestPlayedIndex === null ? "" : highestPlayedIndex}`;
}
