export const GRID_SIZE = 16;
export const INITIAL_DIRECTION = "right";

export const DIRECTIONS = {
  up: { x: 0, y: -1 },
  down: { x: 0, y: 1 },
  left: { x: -1, y: 0 },
  right: { x: 1, y: 0 },
};

function hashCell(cell) {
  return `${cell.x},${cell.y}`;
}

function getAvailableCells(gridSize, snake) {
  const occupied = new Set(snake.map(hashCell));
  const cells = [];

  for (let y = 0; y < gridSize; y += 1) {
    for (let x = 0; x < gridSize; x += 1) {
      const key = hashCell({ x, y });
      if (!occupied.has(key)) {
        cells.push({ x, y });
      }
    }
  }

  return cells;
}

export function pickFoodPosition(gridSize, snake, randomFn = Math.random) {
  const availableCells = getAvailableCells(gridSize, snake);

  if (availableCells.length === 0) {
    return null;
  }

  const index = Math.floor(randomFn() * availableCells.length);
  return availableCells[index];
}

export function createInitialState(options = {}) {
  const gridSize = options.gridSize ?? GRID_SIZE;
  const center = Math.floor(gridSize / 2);
  const snake = [
    { x: center, y: center },
    { x: center - 1, y: center },
    { x: center - 2, y: center },
  ];

  return {
    gridSize,
    snake,
    direction: INITIAL_DIRECTION,
    nextDirection: INITIAL_DIRECTION,
    food: pickFoodPosition(gridSize, snake, options.randomFn),
    score: 0,
    gameOver: false,
    won: false,
  };
}

export function canTurn(currentDirection, nextDirection) {
  if (currentDirection === nextDirection) {
    return true;
  }

  return !(
    (currentDirection === "up" && nextDirection === "down") ||
    (currentDirection === "down" && nextDirection === "up") ||
    (currentDirection === "left" && nextDirection === "right") ||
    (currentDirection === "right" && nextDirection === "left")
  );
}

export function setDirection(state, direction) {
  if (!DIRECTIONS[direction]) {
    return state;
  }

  if (!canTurn(state.nextDirection, direction) && state.snake.length > 1) {
    return state;
  }

  return {
    ...state,
    nextDirection: direction,
  };
}

function collidesWithWall(position, gridSize) {
  return (
    position.x < 0 ||
    position.y < 0 ||
    position.x >= gridSize ||
    position.y >= gridSize
  );
}

function collidesWithSnake(position, snake) {
  return snake.some((segment) => segment.x === position.x && segment.y === position.y);
}

export function stepGame(state, options = {}) {
  if (state.gameOver || state.won) {
    return state;
  }

  const direction = state.nextDirection;
  const vector = DIRECTIONS[direction];
  const currentHead = state.snake[0];
  const nextHead = {
    x: currentHead.x + vector.x,
    y: currentHead.y + vector.y,
  };

  const ateFood =
    state.food &&
    nextHead.x === state.food.x &&
    nextHead.y === state.food.y;

  const nextSnake = [nextHead, ...state.snake];

  if (!ateFood) {
    nextSnake.pop();
  }

  if (
    collidesWithWall(nextHead, state.gridSize) ||
    collidesWithSnake(nextHead, nextSnake.slice(1))
  ) {
    return {
      ...state,
      direction,
      gameOver: true,
    };
  }

  const nextFood = ateFood
    ? pickFoodPosition(state.gridSize, nextSnake, options.randomFn)
    : state.food;

  return {
    ...state,
    snake: nextSnake,
    direction,
    nextDirection: direction,
    food: nextFood,
    score: state.score + (ateFood ? 1 : 0),
    won: ateFood && nextFood === null,
  };
}
