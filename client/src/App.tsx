import { useSocket } from './hooks/useSocket';
import { Lobby } from './components/Lobby';
import { Table } from './components/Table';

export function App() {
  const {
    connected,
    roomCode,
    playerId,
    gameState,
    error,
    actions,
    liveDragPositions,
  } = useSocket();

  // If we're in a room and have game state, show the table
  if (roomCode && playerId && gameState) {
    return (
      <Table
        gameState={gameState}
        playerId={playerId}
        roomCode={roomCode}
        actions={actions}
        error={error}
        liveDragPositions={liveDragPositions}
      />
    );
  }

  // Otherwise show the lobby
  return (
    <Lobby
      actions={actions}
      error={error}
      connected={connected}
    />
  );
}
