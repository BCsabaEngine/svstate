export const randomId = () => Math.random().toString(36).slice(2, 8);

export const randomInt = (min: number, max: number) => Math.floor(Math.random() * (max - min + 1)) + min;

export const formatFieldName = (property: string) =>
	property.charAt(0).toUpperCase() + property.slice(1).replaceAll(/([A-Z])/g, ' $1');
