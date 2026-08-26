import baseCharacters from '../data/characters.json';
import travelers from '../data/traveler.json';

const charactersData = [...travelers, ...baseCharacters].sort((a, b) => a.release_order - b.release_order);

export default charactersData;
