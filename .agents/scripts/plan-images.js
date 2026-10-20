// The images get-plan-images showed the agent during the chat: the planner's
// answers to getExternalObjectSnapshot within a turn, as files named by their
// turn and their order in it, so the evaluation sees what the agent saw.
const VIEWS = [
  ['perspectiveImage', 'perspective'],
  ['topImage', 'top'],
];

export const planImageFiles = (answers) => {
  const callsPerTurn = new Map();
  return answers.flatMap(({ turn, result }) => {
    const views = VIEWS.filter(
      ([field]) => typeof result?.[field] === 'string'
    );
    if (views.length === 0) {
      return [];
    }
    const call = (callsPerTurn.get(turn) ?? 0) + 1;
    callsPerTurn.set(turn, call);
    return views.map(([field, view]) => ({
      turn,
      file: `turn-${turn + 1}-plan-images-${call}-${view}.png`,
      data: Buffer.from(
        result[field].replace(/^data:image\/\w+;base64,/, ''),
        'base64'
      ),
    }));
  });
};
