// Semantic quest/errand category shared by both hosts; independent of visual hint styling.
// Keep the historical label rule: this does not infer completion or change quest state.
export const questMark = (head = 'New quest') => /errand/i.test(head) ? '◇' : '◆';
