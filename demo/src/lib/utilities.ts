export const randomId = () => Math.random().toString(36).slice(2, 8);

export const randomInt = (min: number, max: number) => Math.floor(Math.random() * (max - min + 1)) + min;
