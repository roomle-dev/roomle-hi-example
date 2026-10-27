// The images get-plan-images showed the agent during the chat: the image parts
// of its results within a turn, as files named by their turn, their order in
// it and their format, so the evaluation sees what the agent saw. The last
// image of a result is the top view, an image before it the groups alone.
const VIEWS_BY_COUNT = new Map([
  [1, ['top']],
  [2, ['perspective-object', 'top']],
]);
const EXTENSIONS = new Map([['image/jpeg', 'jpg']]);

export const planImageFiles = (answers) => {
  const callsPerTurn = new Map();
  return answers.flatMap(({ turn, result }) => {
    const images = (result?.content ?? []).filter(
      (part) => part.type === 'image'
    );
    const views = VIEWS_BY_COUNT.get(images.length);
    if (!views) {
      return [];
    }
    const call = (callsPerTurn.get(turn) ?? 0) + 1;
    callsPerTurn.set(turn, call);
    return images.map((image, index) => ({
      turn,
      file: `turn-${turn + 1}-plan-images-${call}-${views[index]}.${EXTENSIONS.get(image.mimeType) ?? 'png'}`,
      data: Buffer.from(image.data, 'base64'),
    }));
  });
};
