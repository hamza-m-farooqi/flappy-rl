/**
 * Backward-compatibility shim.
 *
 * All existing pages that import from ``../../game/engine`` continue to work
 * unchanged. This module simply re-exports everything from the new canonical
 * location at ``../environments/FlappyBird/engine``.
 */
export * from '../environments/FlappyBird/engine';
