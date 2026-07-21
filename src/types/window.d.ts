export {};

declare global {
  interface Window {
    __grassBladeReady: boolean;
    advanceTime: (milliseconds: number) => void;
    completeContractForDebug?: () => void;
    nextContract: () => void;
    render_game_to_text: () => string;
    restartContract: () => void;
  }
}
