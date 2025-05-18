const DEFAULT_API_BASE_URL = 'http://localhost:8000';
const DEFAULT_TRAINING_WS_URL = 'ws://localhost:8000/ws/training';

export const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL?.trim() || DEFAULT_API_BASE_URL;

export const TRAINING_WS_URL =
  import.meta.env.VITE_TRAINING_WS_URL?.trim() || DEFAULT_TRAINING_WS_URL;
