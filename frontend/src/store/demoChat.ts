import type { ChatService, Conversation, Message, Participant } from './chatService';

export const demoUser = { _id: 'you', name: 'Alex Morgan', username: 'alexm' };
export const demoThreadId = 'maya';
const people: Participant[] = [
  { _id: 'maya', name: 'Maya Chen', username: 'mayachen' },
  { _id: 'jordan', name: 'Jordan Lee', username: 'jordanlee' },
  { _id: 'priya', name: 'Priya Patel', username: 'priyap' },
  { _id: 'eli', name: 'Eli Brooks', username: 'elibrooks' },
  { _id: 'sam', name: 'Sam Rivera', username: 'samrivera' },
  { _id: 'noor', name: 'Noor Hassan', username: 'noorh' },
];

function sampleMessage(conversationId: string, senderId: string, content: string, timestamp: string): Message {
  return {
    _id: `${conversationId}-${timestamp}`, conversationId, senderId, content, isRead: true, createdAt: timestamp,
  };
}

export function makeDemoChat(): ChatService {
  const threads = new Map<string, Message[]>([
    ['maya', [
      sampleMessage('maya', 'maya', 'The print proofs came in this morning. The cobalt cover looks great on the uncoated paper.', '2026-11-22T10:02:00'),
      sampleMessage('maya', 'you', 'Good to hear. Is the small type on the back still legible?', '2026-11-22T10:06:00'),
      sampleMessage('maya', 'maya', 'Yes, especially on the lighter stock. I’d go with that one for the first run.', '2026-11-22T10:08:00'),
      sampleMessage('maya', 'maya', 'Could you check the final layout before 4? I can send it to the printer right after.', '2026-11-22T10:09:00'),
    ]],
    ['jordan', [sampleMessage('jordan', 'jordan', 'I’ll bring the camera on Saturday.', '2026-11-22T09:32:00')]],
    ['priya', [sampleMessage('priya', 'priya', 'Good call on the earlier train.', '2026-11-21T17:42:00')]],
    ['eli', [sampleMessage('eli', 'you', 'Just sent over the playlist.', '2026-11-20T12:05:00')]],
    ['sam', [sampleMessage('sam', 'sam', 'Let’s meet outside the gallery.', '2026-11-18T19:07:00')]],
  ]);
  const conversations = new Map<string, Conversation>();

  function addThread(participant: Participant): Conversation {
    const lastMessage = threads.get(participant._id)?.at(-1) ?? null;
    const date = lastMessage?.createdAt ?? new Date().toISOString();
    const conversation = {
      _id: participant._id,
      title: null,
      isGroup: false,
      participants: [demoUser, participant],
      lastMessage,
      createdAt: date,
      updatedAt: date,
    };
    conversations.set(conversation._id, conversation);
    return conversation;
  }

  people.filter(({ _id }) => threads.has(_id)).forEach(addThread);

  return {
    async conversations() {
      return structuredClone([...conversations.values()]);
    },
    async messages(id) {
      return structuredClone(threads.get(id) ?? []);
    },
    async search(query) {
      const term = query.toLowerCase().replace(/^@/, '');
      return people.filter(({ name, username }) => name.toLowerCase().includes(term) || username?.includes(term));
    },
    async start(id) {
      const person = people.find(({ _id }) => _id === id);
      if (!person) throw new Error('Person not found');
      return structuredClone(conversations.get(id) ?? addThread(person));
    },
    async send(id, content) {
      const conversation = conversations.get(id);
      if (!conversation) throw new Error('Conversation not found');
      const timestamp = new Date().toISOString();
      const message = { ...sampleMessage(id, demoUser._id, content, timestamp), _id: crypto.randomUUID() };
      threads.set(id, [...(threads.get(id) ?? []), message]);
      conversations.set(id, { ...conversation, lastMessage: message, updatedAt: timestamp });
      return message;
    },
    async suggest(message) {
      return message.conversationId === demoThreadId
        ? ['I’ll check it before 4.', 'Send me the final PDF.', 'Can we review it together?']
        : ['Sounds good to me.', 'I’ll confirm shortly.', 'Can you send the details?'];
    },
    async summarize(id) {
      if (id === demoThreadId) {
        return 'Maya recommends the lighter uncoated stock for the first print run. Alex needs to check the final layout by 4 so Maya can send it to the printer.';
      }
      const recent = threads.get(id)?.at(-1);
      return recent ? `The latest message in this thread was “${recent.content}”` : 'This thread has no messages yet.';
    },
  };
}
