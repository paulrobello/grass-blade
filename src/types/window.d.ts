export {};

declare global {
  interface Window {
    __grassBladeReady: boolean;
    advanceTime: (milliseconds: number) => void;
    render_game_to_text: () => string;
  }
}
