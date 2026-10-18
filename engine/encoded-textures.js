// Pictures kept encoded for the engine to decode (engine/boot.js encodedPicture), by name. A material names one in its
// userData by this name, a string, as three's material and texture clones copy userData through JSON (a Texture or its
// bytes there would come out as plain objects): the portrait head's eye paint, issue #473.
export const ENCODED_TEXTURES = new Map();
