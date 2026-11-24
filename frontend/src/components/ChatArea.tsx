'use client';

import { Fragment, useEffect, useLayoutEffect, useRef, useState, type FormEvent, type KeyboardEvent } from 'react';
import Link from 'next/link';
import { ArrowLeft, ArrowUp, Check, CheckCheck, FileText, MessageSquare, X } from 'lucide-react';
import { fetchMessages, fetchOlder, sendMessage, suggestReplies, summarizeThread } from '../store/chatSlice';
import type { Conversation, Message, Participant } from '../store/chatService';
import { useAppDispatch, useAppSelector } from '../store/Providers';
import { conversationName, conversationPerson } from './Sidebar';
import { Avatar } from './Identity';

const dateFormat = new Intl.DateTimeFormat('en', { weekday: 'long', month: 'long', day: 'numeric' });
const timeFormat = new Intl.DateTimeFormat('en', { hour: 'numeric', minute: '2-digit' });
const emptyMessages: Message[] = [];

function dayOf(message: Message) {
  return dateFormat.format(new Date(message.createdAt));
}

function timeOf(message: Message) {
  return timeFormat.format(new Date(message.createdAt));
}

export function ChatArea({ conversation, user, inboxHref, assistanceEnabled }: {
  conversation: Conversation;
  user: Participant;
  inboxHref: string;
  assistanceEnabled: boolean;
}) {
  const id = conversation._id;
  const dispatch = useAppDispatch();
  const messages = useAppSelector((state) => state.chat.messages[id] ?? emptyMessages);
  const status = useAppSelector((state) => state.chat.threadStatus[id]);
  const before = useAppSelector((state) => state.chat.before[id]);
  const olderStatus = useAppSelector((state) => state.chat.olderStatus[id]);
  const previousScroll = useRef<{ height: number; top: number } | null>(null);
  const pendingMessage = useRef<{ content: string; id: string } | null>(null);
  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);
  const [sendError, setSendError] = useState('');
  const [replyError, setReplyError] = useState('');
  const [replies, setReplies] = useState<{ messageId: string; items: string[] } | null>(null);
  const [suggesting, setSuggesting] = useState(false);
  const [summaryOpen, setSummaryOpen] = useState(false);
  const [summary, setSummary] = useState<{ count: number; text: string } | null>(null);
  const [summaryError, setSummaryError] = useState('');
  const [summaryLoading, setSummaryLoading] = useState(false);
  const transcript = useRef<HTMLDivElement>(null);
  const input = useRef<HTMLTextAreaElement>(null);
  const followMessages = useRef(true);
  const person = conversationPerson(conversation, user._id);
  const name = conversationName(conversation, user._id);
  const newestMessage = messages.at(-1);
  const incoming = newestMessage && newestMessage.senderId !== user._id ? newestMessage : undefined;
  const visibleReplies = incoming && replies?.messageId === incoming._id ? replies.items : [];

  useEffect(() => {
    const scroll = transcript.current;
    if (scroll && followMessages.current) scroll.scrollTop = scroll.scrollHeight;
  }, [messages]);

  useLayoutEffect(() => {
    if (olderStatus === 'loading') return;
    const previous = previousScroll.current;
    const scroll = transcript.current;
    if (olderStatus === 'ready' && previous && scroll) {
      scroll.scrollTop = previous.top + scroll.scrollHeight - previous.height;
    }
    previousScroll.current = null;
  }, [olderStatus, messages]);

  function loadEarlier() {
    const scroll = transcript.current;
    if (scroll) previousScroll.current = { height: scroll.scrollHeight, top: scroll.scrollTop };
    followMessages.current = false;
    void dispatch(fetchOlder(id));
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const content = draft.trim();
    if (!content || sending) return;
    setSending(true);
    setSendError('');
    try {
      followMessages.current = true;
      const attempt = pendingMessage.current?.content === content
        ? pendingMessage.current : { content, id: crypto.randomUUID() };
      pendingMessage.current = attempt;
      await dispatch(sendMessage({ conversationId: id, content, clientMessageId: attempt.id })).unwrap();
      pendingMessage.current = null;
      setDraft((current) => current.trim() === content ? '' : current);
    } catch {
      setSendError('Message could not be sent. Try sending it again.');
    } finally {
      setSending(false);
    }
  }

  function onComposerKey(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key === 'Enter' && !event.shiftKey && !event.nativeEvent.isComposing &&
      window.matchMedia('(pointer: fine)').matches) {
      event.preventDefault();
      event.currentTarget.form?.requestSubmit();
    }
  }

  async function requestReplies() {
    if (!incoming || suggesting) return;
    setSuggesting(true);
    setReplyError('');
    try {
      const result = await dispatch(suggestReplies(incoming)).unwrap();
      setReplies({ messageId: incoming._id, items: result });
      if (!result.length) setReplyError('No replies suggested. Try again or write your own.');
    } catch {
      setReplyError('Reply suggestions are unavailable. You can still write a message.');
    } finally {
      setSuggesting(false);
    }
  }

  async function toggleSummary() {
    setSummaryOpen(!summaryOpen);
    if (summaryOpen || summaryLoading || summary?.count === messages.length) return;
    setSummaryLoading(true);
    setSummaryError('');
    try {
      const text = await dispatch(summarizeThread(id)).unwrap();
      setSummary({ count: messages.length, text });
    } catch {
      setSummaryError('The summary is unavailable. Close and reopen it to try again.');
    } finally {
      setSummaryLoading(false);
    }
  }

  return (
    <section className="thread" aria-labelledby="thread-heading">
      <header className="thread-header">
        <Link href={inboxHref} className="icon-button mobile-back" aria-label="Back to inbox">
          <ArrowLeft size={20} aria-hidden="true" />
        </Link>
        <Avatar name={name} id={person?._id} />
        <div className="thread-identity">
          <h1 id="thread-heading">{name}</h1>
          {person?.username && <p>@{person.username}</p>}
        </div>
        {assistanceEnabled && <button type="button" className="button button--outline summary-button" disabled={!messages.length}
          aria-expanded={summaryOpen} aria-controls="thread-summary" onClick={() => void toggleSummary()}>
          <FileText size={16} aria-hidden="true" /> <span>Summary</span>
        </button>}
      </header>
      {assistanceEnabled && summaryOpen && (
        <section id="thread-summary" className="summary-box" aria-label="Conversation summary">
          <div className="summary-title">
            <h2>Conversation summary</h2>
            <button type="button" className="icon-button" aria-label="Close summary" onClick={() => setSummaryOpen(false)}>
              <X size={16} aria-hidden="true" />
            </button>
          </div>
          <p role="status">{summaryLoading ? 'Summarizing…' : summaryError || summary?.text}</p>
        </section>
      )}
      <div className="transcript" role="log" aria-label="Messages" ref={transcript} tabIndex={0}
        onScroll={({ currentTarget }) => {
          followMessages.current = currentTarget.scrollHeight - currentTarget.scrollTop - currentTarget.clientHeight < 64;
        }}>
        <div className="transcript-content">
          {before && (
            <div className="thread-note">
              <button type="button" className="button button--outline" disabled={olderStatus === 'loading'} onClick={loadEarlier}>
                {olderStatus === 'loading' ? 'Loading earlier messages…' : olderStatus === 'error' ? 'Retry earlier messages' : 'Load earlier messages'}
              </button>
            </div>
          )}
          {(status === 'idle' || status === 'loading' || !status) && !messages.length && <p className="thread-note">Loading messages…</p>}
          {status === 'error' && (
            <div className="thread-note" role="alert">Could not load messages.{' '}
              <button type="button" className="text-button" onClick={() => void dispatch(fetchMessages(id))}>Try again</button>
            </div>
          )}
          {status === 'ready' && !messages.length && <p className="thread-note">Start the conversation with {name}.</p>}
          {messages.map((message, index) => {
            const previous = messages[index - 1];
            const newDay = !previous || dayOf(previous) !== dayOf(message);
            const sameSender = !newDay && previous.senderId === message.senderId &&
              Date.parse(message.createdAt) - Date.parse(previous.createdAt) < 5 * 60 * 1000;
            const mine = message.senderId === user._id;
            const sender = conversation.participants.find((participant) => participant?._id === message.senderId);
            return (
              <Fragment key={message._id}>
                {newDay && <div className="day-divider"><time dateTime={message.createdAt}>{dayOf(message)}</time></div>}
                <div className={`message-line${mine ? ' message-line--mine' : ''}${sameSender ? ' message-line--grouped' : ''}`}>
                  {!mine && !sameSender && <Avatar name={sender?.name || name} id={message.senderId} size="small" />}
                  <div className="message-content">
                    <p className={`bubble${mine ? ' bubble--mine' : ''}`}>
                      <span className="sr-only">{mine ? 'You' : sender?.name || name}: </span>{message.content}
                    </p>
                    <span className="message-meta">
                      <time dateTime={message.createdAt}>{timeOf(message)}</time>
                      {mine && <span role="img" title={message.isRead ? 'Read' : 'Sent'} aria-label={message.isRead ? 'Read' : 'Sent'}>
                        {message.isRead ? <CheckCheck size={13} aria-hidden="true" /> : <Check size={13} aria-hidden="true" />}
                      </span>}
                    </span>
                  </div>
                </div>
              </Fragment>
            );
          })}
        </div>
      </div>
      <div className="composer-region">
        {assistanceEnabled && <div className="composer-tools">
          {incoming && <button type="button" className="suggest-button" disabled={suggesting} onClick={() => void requestReplies()}>
            <MessageSquare size={16} aria-hidden="true" /> {suggesting ? 'Looking for replies…' : 'Suggest replies'}
          </button>}
          {!!visibleReplies.length && (
            <div className="reply-list" aria-label="Suggested replies">
              {visibleReplies.map((reply, index) => (
                <button key={`${index}-${reply}`} type="button" className="reply-option" onClick={() => {
                  setDraft(reply);
                  input.current?.focus();
                }}>{reply}</button>
              ))}
            </div>
          )}
          {replyError && <p className="form-error" role="status">{replyError}</p>}
        </div>}
        <form className="composer" onSubmit={(event) => void submit(event)}>
          <textarea ref={input} aria-label={`Message ${name}`} placeholder={`Message ${name.split(' ')[0]}`}
            rows={2} maxLength={4000} value={draft} onChange={({ target }) => setDraft(target.value)}
            onKeyDown={onComposerKey} />
          <button className="icon-button button--primary send-button" type="submit" aria-label="Send message"
            title="Send message" disabled={sending || !draft.trim()}>
            <ArrowUp size={20} aria-hidden="true" />
          </button>
        </form>
        {sendError && <p className="form-error composer-error" role="alert">{sendError}</p>}
      </div>
    </section>
  );
}
