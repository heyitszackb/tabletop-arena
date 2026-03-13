import { customAlphabet } from 'nanoid';
import {
  type GameState,
  type ClientGameState,
  type GameAction,
  type CardObject,
  type DeckObject,
  type DieObject,
  ALL_SUITS,
  ALL_RANKS,
} from '@tabletop-arena/shared';

const objectIdGen = customAlphabet('abcdefghijklmnopqrstuvwxyz0123456789', 10);

export class GameStateManager {
  createInitialState(): GameState {
    return {
      objects: {},
      players: {},
      hands: {},
      nextZIndex: 1,
    };
  }

  /**
   * Validate and apply an action to the game state. Mutates state in-place.
   * Returns an error string if the action is invalid, or null on success.
   */
  processAction(
    state: GameState,
    action: GameAction,
    playerId: string,
  ): { error: string } | { diceRoll?: { dieId: string; sides: number } } {
    switch (action.type) {
      case 'grabObject':
        return this.handleGrabObject(state, action.objectId, playerId);

      case 'moveObject':
        // moveObject through gameAction path just updates position on state
        return this.handleMoveObject(state, action.objectId, action.position, playerId);

      case 'releaseObject':
        return this.handleReleaseObject(state, action.objectId, action.position, playerId);

      case 'flipCard':
        return this.handleFlipCard(state, action.cardId, playerId);

      case 'drawCard':
        return this.handleDrawCard(state, action.deckId, action.toHand, playerId);

      case 'playCardFromHand':
        return this.handlePlayCardFromHand(state, action.cardId, action.position, action.faceUp, playerId);

      case 'shuffleDeck':
        return this.handleShuffleDeck(state, action.deckId);

      case 'returnCardToDeck':
        return this.handleReturnCardToDeck(state, action.cardId, action.deckId, playerId);

      case 'rollDie':
        return this.handleRollDie(state, action.dieId);

      case 'addDeck':
        return this.handleAddDeck(state, action.position);

      case 'addDie':
        return this.handleAddDie(state, action.sides, action.position);

      case 'removeObject':
        return this.handleRemoveObject(state, action.objectId);

      default: {
        const _exhaustive: never = action;
        return { error: `Unknown action type: ${(_exhaustive as GameAction).type}` };
      }
    }
  }

  /**
   * Filter game state for a specific player:
   * - Their hand: full CardObject data
   * - Other hands: card count only
   */
  getStateForPlayer(state: GameState, playerId: string): ClientGameState {
    const myHandCardIds = state.hands[playerId] ?? [];
    const myHand: CardObject[] = myHandCardIds
      .map(id => state.objects[id])
      .filter((obj): obj is CardObject => obj !== undefined && obj.type === 'card');

    const otherHands: Record<string, number> = {};
    for (const [pid, cardIds] of Object.entries(state.hands)) {
      if (pid !== playerId) {
        otherHands[pid] = cardIds.length;
      }
    }

    return {
      objects: state.objects,
      players: state.players,
      myHand,
      otherHands,
      nextZIndex: state.nextZIndex,
    };
  }

  // ─── Action Handlers ──────────────────────────────────────

  private handleGrabObject(
    state: GameState,
    objectId: string,
    playerId: string,
  ): { error: string } | {} {
    const obj = state.objects[objectId];
    if (!obj) {
      return { error: 'Object not found' };
    }
    if (obj.lockedBy !== null && obj.lockedBy !== playerId) {
      return { error: 'Object is locked by another player' };
    }
    obj.lockedBy = playerId;
    return {};
  }

  private handleMoveObject(
    state: GameState,
    objectId: string,
    position: { x: number; y: number },
    playerId: string,
  ): { error: string } | {} {
    const obj = state.objects[objectId];
    if (!obj) {
      return { error: 'Object not found' };
    }
    if (obj.lockedBy !== playerId) {
      return { error: 'Object is not locked by you' };
    }
    obj.position = position;
    return {};
  }

  private handleReleaseObject(
    state: GameState,
    objectId: string,
    position: { x: number; y: number },
    playerId: string,
  ): { error: string } | {} {
    const obj = state.objects[objectId];
    if (!obj) {
      return { error: 'Object not found' };
    }
    if (obj.lockedBy !== playerId) {
      return { error: 'Object is not locked by you' };
    }
    obj.lockedBy = null;
    obj.position = position;
    obj.zIndex = state.nextZIndex++;
    return {};
  }

  private handleFlipCard(
    state: GameState,
    cardId: string,
    _playerId: string,
  ): { error: string } | {} {
    const obj = state.objects[cardId];
    if (!obj || obj.type !== 'card') {
      return { error: 'Card not found' };
    }
    obj.faceUp = !obj.faceUp;
    return {};
  }

  private handleDrawCard(
    state: GameState,
    deckId: string,
    toHand: boolean,
    playerId: string,
  ): { error: string } | {} {
    const deck = state.objects[deckId];
    if (!deck || deck.type !== 'deck') {
      return { error: 'Deck not found' };
    }
    if (deck.cardIds.length === 0) {
      return { error: 'Deck is empty' };
    }

    // Draw from top (last element)
    const cardId = deck.cardIds.pop()!;
    const card = state.objects[cardId];
    if (!card || card.type !== 'card') {
      return { error: 'Card not found in objects' };
    }

    card.deckId = null;

    if (toHand) {
      // Add to player's hand
      if (!state.hands[playerId]) {
        state.hands[playerId] = [];
      }
      state.hands[playerId]!.push(cardId);
      card.faceUp = true; // Cards in hand are face-up to the owner
    } else {
      // Place on table near deck
      card.position = {
        x: deck.position.x + 80,
        y: deck.position.y,
      };
      card.faceUp = true;
      card.zIndex = state.nextZIndex++;
    }

    return {};
  }

  private handlePlayCardFromHand(
    state: GameState,
    cardId: string,
    position: { x: number; y: number },
    faceUp: boolean,
    playerId: string,
  ): { error: string } | {} {
    const hand = state.hands[playerId];
    if (!hand) {
      return { error: 'Player has no hand' };
    }

    const cardIndex = hand.indexOf(cardId);
    if (cardIndex === -1) {
      return { error: 'Card not in your hand' };
    }

    // Remove from hand
    hand.splice(cardIndex, 1);

    const card = state.objects[cardId];
    if (!card || card.type !== 'card') {
      return { error: 'Card not found' };
    }

    // Place on table
    card.position = position;
    card.faceUp = faceUp;
    card.lockedBy = null;
    card.zIndex = state.nextZIndex++;

    return {};
  }

  private handleShuffleDeck(
    state: GameState,
    deckId: string,
  ): { error: string } | {} {
    const deck = state.objects[deckId];
    if (!deck || deck.type !== 'deck') {
      return { error: 'Deck not found' };
    }

    // Fisher-Yates shuffle
    const cards = deck.cardIds;
    for (let i = cards.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [cards[i], cards[j]] = [cards[j]!, cards[i]!];
    }

    return {};
  }

  private handleReturnCardToDeck(
    state: GameState,
    cardId: string,
    deckId: string,
    playerId: string,
  ): { error: string } | {} {
    const deck = state.objects[deckId];
    if (!deck || deck.type !== 'deck') {
      return { error: 'Deck not found' };
    }

    const card = state.objects[cardId];
    if (!card || card.type !== 'card') {
      return { error: 'Card not found' };
    }

    // Check if card is in player's hand and remove it
    const hand = state.hands[playerId];
    if (hand) {
      const handIndex = hand.indexOf(cardId);
      if (handIndex !== -1) {
        hand.splice(handIndex, 1);
      }
    }

    // Add card back to deck
    card.deckId = deckId;
    card.faceUp = false;
    card.lockedBy = null;
    deck.cardIds.push(cardId);

    return {};
  }

  private handleRollDie(
    state: GameState,
    dieId: string,
  ): { error: string } | { diceRoll: { dieId: string; sides: number } } {
    const die = state.objects[dieId];
    if (!die || die.type !== 'die') {
      return { error: 'Die not found' };
    }

    // Mark as rolling initially — caller will set final value after delay
    die.rolling = true;

    return { diceRoll: { dieId: die.id, sides: die.sides } };
  }

  /** Finalize a dice roll: set random value, mark rolling=false */
  finalizeDiceRoll(state: GameState, dieId: string): void {
    const die = state.objects[dieId];
    if (!die || die.type !== 'die') return;
    die.value = Math.floor(Math.random() * die.sides) + 1;
    die.rolling = false;
  }

  private handleAddDeck(
    state: GameState,
    position: { x: number; y: number },
  ): { error: string } | {} {
    const deckId = objectIdGen();
    const cardIds: string[] = [];

    // Create all 52 cards
    for (const suit of ALL_SUITS) {
      for (const rank of ALL_RANKS) {
        const cardId = objectIdGen();
        const card: CardObject = {
          id: cardId,
          type: 'card',
          position: { ...position }, // Same position as deck initially
          zIndex: 0,
          rotation: 0,
          lockedBy: null,
          suit,
          rank,
          faceUp: false,
          deckId,
        };
        state.objects[cardId] = card;
        cardIds.push(cardId);
      }
    }

    const deck: DeckObject = {
      id: deckId,
      type: 'deck',
      position,
      zIndex: state.nextZIndex++,
      rotation: 0,
      lockedBy: null,
      cardIds,
      name: 'Standard 52-Card Deck',
    };

    state.objects[deckId] = deck;
    return {};
  }

  private handleAddDie(
    state: GameState,
    sides: DieObject['sides'],
    position: { x: number; y: number },
  ): { error: string } | {} {
    const dieId = objectIdGen();
    const die: DieObject = {
      id: dieId,
      type: 'die',
      position,
      zIndex: state.nextZIndex++,
      rotation: 0,
      lockedBy: null,
      sides,
      value: Math.floor(Math.random() * sides) + 1,
      rolling: false,
    };

    state.objects[dieId] = die;
    return {};
  }

  private handleRemoveObject(
    state: GameState,
    objectId: string,
  ): { error: string } | {} {
    const obj = state.objects[objectId];
    if (!obj) {
      return { error: 'Object not found' };
    }

    // If it's a deck, also remove all its cards
    if (obj.type === 'deck') {
      for (const cardId of obj.cardIds) {
        delete state.objects[cardId];
      }
      // Also remove any cards from hands that belong to this deck
      for (const [playerId, hand] of Object.entries(state.hands)) {
        state.hands[playerId] = hand.filter(cardId => {
          const card = state.objects[cardId];
          // Keep card in hand if it still exists (wasn't from this deck's cardIds)
          return card !== undefined;
        });
      }
    }

    // If it's a card, also remove from any hand
    if (obj.type === 'card') {
      for (const [playerId, hand] of Object.entries(state.hands)) {
        const idx = hand.indexOf(objectId);
        if (idx !== -1) {
          hand.splice(idx, 1);
        }
      }
    }

    delete state.objects[objectId];
    return {};
  }
}
