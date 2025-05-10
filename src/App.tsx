import { useEffect, useMemo, useState } from "react";
import { css } from "@emotion/react";
import styled from "@emotion/styled";

import { cardToString, valuateSpecial } from "../common/card-game";

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

  &.back {
    box-shadow: inset 0 0 0 0.24rem white;
    background: #ff9f96;
  }
`;

const StyledCardGroup = styled.div`
  display: flex;
  margin: 0 0.6rem;
  gap: 0.2rem;
  margin: 0.6rem 0;
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

const CardGroup: React.FC<{ value: number[] }> = ({ value }) => {
  return (
    <StyledCardGroup>
      {value.map((c: number, j: number) => (
        <Card key={j} value={c} />
      ))}
    </StyledCardGroup>
  );
};

export function App() {
  // Replace the default seedIndex state with one that syncs with the URL.
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

  // Use our custom hook instead of the original useState call.
  const [seedIndex, setSeedIndex] = useSeedIndex();
  const state = useMemo(() => {
    const { state: s, valuation, moves } = valuateSpecial(seedIndex, 2, 4, 1, null);
    console.log(seedIndex, valuation, moves); // eslint-disable-line no-console
    return s;
  }, [seedIndex]);

  const handleClick = () => {
    const newSeedIndex = Math.floor(Math.random() * 10000);
    setSeedIndex(newSeedIndex);
  };

  const showAllCards = false;
  return (
    <StyledApp onClick={handleClick}>
      <div>
        {state!.players.map((player, i) => (
          <CardGroup key={i} value={player.cards.map((c) => (showAllCards || i === state!.playerIndex ? c : -1))} />
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
