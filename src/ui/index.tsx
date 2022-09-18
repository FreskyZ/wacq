// @ts-ignore
import React, { useReducer } from 'react';
import { useState, useEffect, useRef } from 'react';
import ReactDOM from 'react-dom';
import { Select, Button } from 'antd';
import dayjs from 'dayjs';
import * as api from '../api-decl';
import { Message } from '../api-decl/types';

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
                    ? <img src={match[3]} referrerPolicy='no-referrer' />
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
    const [time, setTime] = useState<string>();
    const callbackref = useRef<() => void>();

    useEffect(() => {
        api.$default.getRecentGroups().then(groups => setGroups(groups));
    }, []);

    useEffect(() => {
        setGroup(groups[0]);
    }, [groups]);

    useEffect(() => {
        handleRefresh();
    }, [group]);

    function handleRefresh() {
        if (group != 0) {
            api.$default.getGroupRecentMessages(group).then(messages => setMessages(messages));
        }
    }
    callbackref.current = handleRefresh;

    useEffect(() => {
        const id = setInterval(() => callbackref.current(), 10000);
        return () => clearInterval(id);
    }, []);

    useEffect(() => {
        const id = setInterval(() => setTime(dayjs().format('HH:mm:ss')), 1000);
        return () => clearInterval(id);
    }, []);

    return <>
        <header>WACQ</header>
        <Select value={group} onChange={e => setGroup(e)}>
            {groups.map(g => <Select.Option key={g} value={g}>{g}</Select.Option>)}
        </Select>
        <Button className='refresh' onClick={() => handleRefresh()}>刷新</Button>
        <span>{time}</span>
        <Messages messages={messages} />
    </>;
}

// antd@4 does not support react@18, for now
ReactDOM.render(<App />, document.querySelector('main'));
