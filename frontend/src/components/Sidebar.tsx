'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { ArrowUpRight, Plus, Search, X } from 'lucide-react';
import { Avatar } from './Identity';
import { createConversation, fetchConversations, markConversationRead, searchUsers } from '../store/chatSlice';
import type { Conversation, Participant } from '../store/chatService';
import { useAppDispatch, useAppSelector } from '../store/Providers';

export function conversationName(conversation: Conversation, userId: string) {
  return conversationPerson(conversation, userId)?.name || conversation.title || 'Conversation';
}

export function conversationPerson(conversation: Conversation, userId: string) {
  return conversation.isGroup ? undefined : conversation.participants.find((participant) => participant?._id !== userId && participant?.name);
}

function formatListTime(value: string) {
  const date = new Date(value);
  if (date.toDateString() === new Date().toDateString()) {
    return new Intl.DateTimeFormat('en', { hour: 'numeric', minute: '2-digit' }).format(date);
  }
  return new Intl.DateTimeFormat('en', { month: 'short', day: 'numeric' }).format(date);
}

function StartConversation({ onClose, onSelect }: {
  onClose: () => void;
  onSelect: (id: string) => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<Participant[]>([]);
  const [status, setStatus] = useState('Searching…');
  const [starting, setStarting] = useState('');
  const [startError, setStartError] = useState('');
  const dispatch = useAppDispatch();

  useEffect(() => {
    dialog.current?.showModal();
  }, []);

  useEffect(() => {
    const request = dispatch(searchUsers(query.trim().replace(/^@/, '')));
    let current = true;
    void request.unwrap().then(
      (people) => {
        if (!current) return;
        setResults(people);
        setStatus(people.length ? '' : query.trim() ? 'No people match that search.' : 'No people to show yet.');
      },
      () => { if (current) setStatus('Search could not load. Try another search.'); },
    );
    return () => {
      current = false;
      request.abort();
    };
  }, [query, dispatch]);

  async function start(person: Participant) {
    setStarting(person._id);
    setStartError('');
    try {
      const conversation = await dispatch(createConversation(person._id)).unwrap();
      if (dialog.current?.open) onSelect(conversation._id);
    } catch {
      setStartError('Could not start this conversation. Try again.');
    } finally {
      setStarting('');
    }
  }

  return (
    <dialog ref={dialog} className="people-dialog" aria-labelledby="new-conversation-heading" onClose={onClose}>
      <div className="dialog-heading">
        <h2 id="new-conversation-heading">New conversation</h2>
        <button type="button" className="icon-button" aria-label="Close new conversation" onClick={() => dialog.current?.close()}>
          <X size={18} aria-hidden="true" />
        </button>
      </div>
      <label className="search-field">
        <Search size={16} aria-hidden="true" />
        <input type="search" aria-label="Search people" placeholder="Name or username" value={query} autoFocus
          onChange={({ target }) => {
            setQuery(target.value);
            setStatus('Searching…');
            setResults([]);
            setStartError('');
          }} />
      </label>
      {status && <p className="list-note" role="status">{status}</p>}
      {startError && <p className="form-error" role="alert">{startError}</p>}
      <ul className="people-list">
        {results.map((person) => (
          <li key={person._id}>
            <button type="button" className="person-option" disabled={!!starting} onClick={() => void start(person)}>
              <Avatar name={person.name} id={person._id} />
              <span className="person-text"><strong>{person.name}</strong>{person.username && <span>@{person.username}</span>}</span>
              <span className="person-action">{starting === person._id ? 'Opening…' : <ArrowUpRight size={17} aria-hidden="true" />}</span>
            </button>
          </li>
        ))}
      </ul>
    </dialog>
  );
}

export function Sidebar({ user, activeId, basePath, onSelect }: {
  user: Participant;
  activeId?: string;
  basePath: string;
  onSelect: (id: string) => void;
}) {
  const { conversations, inboxStatus } = useAppSelector((state) => state.chat);
  const dispatch = useAppDispatch();
  const [query, setQuery] = useState('');
  const [showNew, setShowNew] = useState(false);
  const newButton = useRef<HTMLButtonElement>(null);
  const needle = query.trim().toLowerCase().replace(/^@/, '');
  const visible = conversations.filter((conversation) => {
    const name = conversationName(conversation, user._id);
    const person = conversationPerson(conversation, user._id);
    return `${name} ${person?.username ?? ''}`.toLowerCase().includes(needle);
  });

  function closePicker() {
    setShowNew(false);
    newButton.current?.focus();
  }

  return (
    <aside className="inbox-sidebar" aria-labelledby="inbox-heading">
      <div className="sidebar-heading">
        <div className="sidebar-title">
          <h1 id="inbox-heading">Inbox</h1>
          <button ref={newButton} type="button" className="icon-button button--primary new-chat"
            aria-label="New conversation" title="New conversation" onClick={() => setShowNew(true)}>
            <Plus size={20} aria-hidden="true" />
          </button>
        </div>
        <label className="search-field">
          <Search size={16} aria-hidden="true" />
          <input type="search" aria-label="Search conversations" placeholder="Search conversations" value={query}
            onChange={({ target }) => setQuery(target.value)} />
        </label>
      </div>
      <nav className="conversation-index" aria-label="Conversations">
        <h2>Conversations</h2>
        {inboxStatus === 'loading' && <p className="list-note" role="status">Loading conversations…</p>}
        {inboxStatus === 'error' && (
          <div className="list-note" role="alert">
            <p>Could not load conversations.</p>
            <button type="button" className="text-button" onClick={() => void dispatch(fetchConversations())}>Try again</button>
          </div>
        )}
        {inboxStatus === 'ready' && !visible.length && (
          <div className="list-note">
            <p>{needle ? 'No conversations match that search.' : 'Your conversations will appear here.'}</p>
            {!needle && <button type="button" className="text-button" onClick={() => setShowNew(true)}>Start a conversation</button>}
          </div>
        )}
        <ul className="conversation-list">
          {visible.map((conversation) => {
            const person = conversationPerson(conversation, user._id);
            const name = conversationName(conversation, user._id);
            const active = conversation._id === activeId;
            return (
              <li key={conversation._id}>
                <Link className="conversation-link" href={`${basePath}/c/${encodeURIComponent(conversation._id)}`}
                  aria-current={active ? 'page' : undefined}
                  onClick={() => dispatch(markConversationRead(conversation._id))}>
                  <Avatar name={name} id={person?._id} />
                  <span className="conversation-text">
                    <span className="conversation-title">
                      <strong>{name}</strong>
                      {conversation.lastMessage && (
                        <time dateTime={conversation.lastMessage.createdAt}>{formatListTime(conversation.lastMessage.createdAt)}</time>
                      )}
                    </span>
                    <span className="conversation-preview">
                      {conversation.lastMessage?.senderId === user._id && 'You: '}
                      {conversation.lastMessage?.content || 'No messages yet'}
                    </span>
                  </span>
                  {!!conversation.unreadCount && <span className="unread-dot" aria-label={`${conversation.unreadCount} unread`} />}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>
      <div className="sidebar-account">
        <Avatar name={user.name} id={user._id} size="small" />
        <div className="person-text"><strong>{user.name}</strong>{user.username && <span>@{user.username}</span>}</div>
      </div>
      {showNew && (
        <StartConversation onClose={closePicker} onSelect={(id) => {
          setShowNew(false);
          onSelect(id);
        }} />
      )}
    </aside>
  );
}
