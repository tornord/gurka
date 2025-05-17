import { useEffect, useMemo, useState } from "react";
import { css } from "@emotion/react";
import styled from "@emotion/styled";

import { cardToString, valuateSpecial } from "../common/card-game";
import { GamePhase } from "../common/game-phase";

// const { floor, random } = Math;

const StyledApp = styled.div(
  () => css`
    display: flex;
    padding: 1rem;
    background: #6d9840;

    > div {
      padding: 0.75rem;
    }
  `
);

const StyledCard = styled.div`
  width: 2rem;
  height: 3rem;
  color: #444;
  border: 1px solid #888;
  border-radius: 0.4rem;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 1.8rem;
  font-weight: bold;
  background: white;

  -webkit-user-select: none;
  user-select: none;

  &.back {
    box-shadow: inset 0 0 0 0.24rem white;
    background: #ff9f96;
  }
`;

const StyledCardGroup = styled.div`
  display: flex;
  gap: 0.2rem;
  margin: 0.6rem 0;

  button {
    border: none;
    background: none;
    padding: 0;
    font-family: inherit;
  }

  .empty {
    width: 2rem;
    height: 3rem;
  }
`;

interface CardProps {
  value: number;
}

const Card: React.FC<CardProps> = ({ value }) => {
  // If value is -1, render a card back side
  if (value === -1) {
    // back side of the card
    return <StyledCard className="back"></StyledCard>;
  }

  return <StyledCard>{cardToString(value)}</StyledCard>;
};

interface CardGroupProps {
  value: number[];
  onClick?: (value: number) => void | null;
}

const CardGroup: React.FC<CardGroupProps> = ({ value, onClick }) => {
  return (
    <StyledCardGroup>
      {value.length > 0 ? (
        value.map((c: number, j: number) => (
          <button key={j} onClick={() => onClick?.(j)}>
            <Card value={c} />
          </button>
        ))
      ) : (
        <div className="empty"></div>
      )}
    </StyledCardGroup>
  );
};

function useSeedIndex(): [number, (newSeed: number) => void] {
  const [seed, setSeed] = useState(() => {
    const params = new URLSearchParams(window.location.search);
    const seedParam = params.get("seed");
    return seedParam !== null && !isNaN(Number(seedParam)) ? Number(seedParam) : Math.floor(Math.random() * 10000);
  });

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    params.set("seed", seed.toString());
    const newUrl = `${window.location.pathname}?${params.toString()}`;
    window.history.replaceState(null, "", newUrl);
  }, [seed]);

  return [seed, setSeed];
}

export function App() {
  const phase = new GamePhase(3, 3, 0, null);
  const [seedIndex, setSeedIndex] = useSeedIndex();
  const state = useMemo(() => {
    const s = valuateSpecial(seedIndex, phase, 6);
    console.log(seedIndex, s!.toString()); // eslint-disable-line no-console
    return s;
  }, [seedIndex]);

  const handleClick = () => {
    const newSeedIndex = Math.floor(Math.random() * 10000);
    // setSeedIndex(newSeedIndex);
  };

  const handleCardClick = (value: number) => {
    console.log(value); // eslint-disable-line no-console
  };

  const showAllCards = state!.players.every((player) => player.cards.length === 1);
  return (
    <StyledApp onClick={handleClick}>
      <div>
        {state!.players.map((player, i) => (
          <CardGroup
            key={i}
            value={player.cards.map((c) => (showAllCards || i === state!.playerIndex ? c : -1))}
            onClick={handleCardClick}
          />
        ))}
      </div>
      <div>
        {state!.players.map((player, playerIndex) => (
          <CardGroup key={playerIndex} value={player.playedCards} />
        ))}
      </div>
    </StyledApp>
  );
}
