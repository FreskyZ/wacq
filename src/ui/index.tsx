// @ts-ignore
import React from 'react';
import { useState, useEffect, useRef } from 'react';
import ReactDOM from 'react-dom';
import { ConfigProvider, Select, Button, Input, message } from 'antd';
import { $default as api } from '../api/client';
import { Message } from '../api/types';

// very primitive technology to add link to image
function MessageContent({ content }: { content: string }) {
    const splitre = /(\[CQ:(?:image|video),file=[\w\.]+,(?:subType=\d+,)?url=.*\])/g;
    const replacere = /\[CQ:(image|video),file=([\w\.]+),(?:subType=\d+,)?url=(.*)\]/g;
    const segments = content.split(splitre);
    return <>
        {segments.filter(s => s).map(seg => {
            const match = replacere.exec(seg);
            return match ? <>
                {match[1] == 'image'
                    ? <a href={match[3]} target='_blank' referrerPolicy='no-referrer'><img src={match[3]} referrerPolicy='no-referrer' /></a>
                    : <a href={match[3].replaceAll(/* video message unexpectedly included the &amp */'&' + 'amp;', '&')} target='_blank' referrerPolicy='no-referrer'>{match[2]}</a>}
            </> : <span>{seg}</span>;
        })}
    </>
}

function Messages({ messages }: { messages: Message[] }) {
    return <div className='messages-container'>
        {messages.map(m => <div key={m.id} className='message-container'>
            <div className='sender'>{m.sender}</div>
            <div className='segments'><MessageContent content={m.content} /></div>
        </div>)}
    </div>;
}

function App() {
    const [group, setGroup] = useState(0);
    const [groups, setGroups] = useState<number[]>([0]);
    const [messages, setMessages] = useState<Message[]>([]);
    const [editingMessage, setEditingMessage] = useState<string>("");
    const callbackref = useRef<() => void>();

    useEffect(() => {
        api.getRecentGroups().then(groups => setGroups(groups));
    }, []);

    useEffect(() => {
        setGroup(groups[0]);
    }, [groups]);

    useEffect(() => {
        handleRefresh();
    }, [group]);

    function handleRefresh() {
        if (group != 0 && document.visibilityState == 'visible') {
            api.getGroupRecentMessages(group).then(messages => setMessages(messages));
        }
    }
    callbackref.current = handleRefresh;

    useEffect(() => {
        const id = setInterval(() => callbackref.current(), 12000);
        return () => clearInterval(id);
    }, []);

    function handleSend() {
        if (editingMessage.trim().length > 0) {
            api.sendGroupMessage({ groupId: group, content: editingMessage.trim() }).then(() => {
                setEditingMessage("");
            }, ex => { message.error(ex); });
        }
    }

    return <>
        <header>WACQ</header>
        <Select value={group} onChange={e => setGroup(e)}>
            {groups.map(g => <Select.Option key={g} value={g}>{g}</Select.Option>)}
        </Select>
        <Button className='refresh' onClick={() => handleRefresh()}>刷新</Button>
        <div className='send-container'>
            <Input value={editingMessage} onChange={e => setEditingMessage(e.target.value)} onPressEnter={handleSend} />
            <Button disabled={editingMessage.trim().length == 0} onClick={handleSend}>发送</Button>
        </div>
        <Messages messages={messages} />
    </>;
}

// antd@4 does not support react@18, for now
ReactDOM.render(<ConfigProvider autoInsertSpaceInButton={false}><App /></ConfigProvider>, document.querySelector('main'));
