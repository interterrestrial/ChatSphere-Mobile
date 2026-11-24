import type { ChatService, Conversation, Message, Person } from './contracts';

export const demoUser = { _id: 'you', name: 'Alex Morgan', username: 'alexm' };

const people: Person[] = [
  { _id: 'maya', name: 'Maya Chen', username: 'mayachen' },
  { _id: 'jordan', name: 'Jordan Lee', username: 'jordanlee' },
  { _id: 'priya', name: 'Priya Patel', username: 'priyap' },
  { _id: 'eli', name: 'Eli Brooks', username: 'elibrooks' },
  { _id: 'sam', name: 'Sam Rivera', username: 'samrivera' },
  { _id: 'noor', name: 'Noor Hassan', username: 'noorh' },
];

export function createDemoChat(): ChatService {
  let sequence = 0;
  const today = new Date();
  const conversationMap = new Map<string, Conversation>();
  const messagesById = new Map<string, Message[]>();

  function sample(id: string, senderId: string, content: string, daysAgo: number, hour: number, minute: number) {
    const timestamp = new Date(today);
    timestamp.setDate(timestamp.getDate() - daysAgo);
    timestamp.setHours(hour, minute, 0, 0);
    const existing = messagesById.get(id) ?? [];
    messagesById.set(id, [...existing, {
      _id: `sample-${++sequence}`, conversationId: id, senderId, content,
      createdAt: timestamp.toISOString(), isRead: true,
    }]);
  }

  sample('maya', 'maya', 'The print proofs came in. The cobalt cover looks great on the uncoated paper.', 1, 10, 2);
  sample('maya', demoUser._id, 'Good to hear. Is the small type on the back still legible?', 1, 10, 6);
  sample('maya', 'maya', 'Yes, especially on the lighter stock. I’d go with that one for the first run.', 1, 10, 8);
  sample('maya', 'maya', 'Could you check the final layout before 4? I can send it to the printer right after.', 1, 10, 9);
  sample('jordan', 'jordan', 'I’ll bring the camera on Saturday.', 1, 9, 32);
  sample('priya', 'priya', 'Good call on the earlier train.', 2, 17, 42);
  sample('eli', demoUser._id, 'Just sent over the playlist.', 3, 12, 5);
  sample('sam', 'sam', 'Let’s meet outside the gallery.', 5, 19, 7);

  function createConversation(person: Person): Conversation {
    const latest = messagesById.get(person._id)?.at(-1) ?? null;
    const timestamp = latest?.createdAt ?? new Date().toISOString();
    const conversation = {
      _id: person._id,
      participants: [demoUser, person],
      title: null,
      isGroup: false,
      lastMessage: latest,
      createdAt: timestamp,
      updatedAt: timestamp,
    };
    conversationMap.set(person._id, conversation);
    return conversation;
  }

  people.filter(({ _id }) => messagesById.has(_id)).forEach(createConversation);

  return {
    async conversations() {
      return [...conversationMap.values()];
    },
    async messages(id, cursor) {
      const messages = messagesById.get(id) ?? [];
      const after = cursor && 'after' in cursor ? messages.findIndex(message => message._id === cursor.after) : -1;
      return { messages: messages.slice(after + 1), nextCursor: null };
    },
    async search(query) {
      const term = query.toLowerCase();
      return people.filter(({ name, username }) =>
        name.toLowerCase().includes(term) || username?.includes(term));
    },
    async start(id) {
      const person = people.find(({ _id }) => _id === id);
      if (!person) throw new Error('Person not found');
      return conversationMap.get(id) ?? createConversation(person);
    },
    async send(id, content, clientMessageId) {
      const conversation = conversationMap.get(id);
      if (!conversation) throw new Error('Conversation not found');
      const message = {
        _id: clientMessageId, conversationId: id, senderId: demoUser._id,
        content, isRead: false, createdAt: new Date().toISOString(),
      };
      messagesById.set(id, [...(messagesById.get(id) ?? []), message]);
      conversationMap.set(id, { ...conversation, lastMessage: message, updatedAt: message.createdAt });
      return message;
    },
    async suggest(message) {
      return message.conversationId === 'maya'
        ? ['I’ll check it before 4.', 'Send me the final PDF.', 'Can we review it together?']
        : ['Sounds good to me.', 'I’ll confirm shortly.', 'Can you send the details?'];
    },
    async summarize(id) {
      const latest = messagesById.get(id)?.at(-1);
      if (id === 'maya') {
        return 'Maya recommends the lighter uncoated stock. Alex needs to check the layout by 4 so Maya can send it to the printer.';
      }
      return latest ? `The latest message was “${latest.content}”` : 'This thread has no messages yet.';
    },
  };
}
