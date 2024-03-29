// @ts-ignore
import React from 'react';
import { useState, useEffect, useRef } from 'react';
import { createRoot } from 'react-dom/client';
import { ConfigProvider, Select, Button, Input, message } from 'antd';
import { $default as api } from '../api/client';
import { Message } from '../api/types';

// very primitive technology to add link to image
function MessageContent({ content }: { content: string }) {
    if (content.startsWith('[CQ:json')) {
        const dataString = content.substring(14, content.length - 1);
        let data: any = null;
        try { data = JSON.parse(dataString); } catch { console.log('unrecognized data string', dataString); }
        if (data && data.meta && data.meta.detail_1 && data.meta.detail_1.qqdocurl && data.meta.detail_1.title == '哔哩哔哩') {
            let url: string = data.meta.detail_1.qqdocurl;
            if (url.includes('?')) {
                const index = url.indexOf('?');
                url = url.substring(0, index);
                return <a href={url} target='_blank' referrerPolicy='no-referrer'>{data.meta.detail_1.desc}</a>
            }
        }
    }
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
    const callbackref = useRef<(switchGroup: boolean) => void>();

    useEffect(() => {
        api.getRecentGroups().then(groups => setGroups(groups));
    }, []);

    useEffect(() => {
        setGroup(groups[0]);
    }, [groups]);

    useEffect(() => {
        handleRefresh(true);
    }, [group]);

    function handleRefresh(switchGroup: boolean) {
        if (group != 0 && document.visibilityState == 'visible') {
            api.getGroupRecentMessages(group, messages.length && !switchGroup ? messages[0].time : 0).then(newMessages => {
                if (switchGroup) {
                    messages.splice(0, 100);
                }
                for (const newMessage of newMessages) {
                    if (!messages.some(m => m.id == newMessage.id)) {
                        messages.push(newMessage);
                    }
                }
                messages.sort((m1, m2) => m2.time - m1.time); // BY TIME DESC
                setMessages([...messages.slice(0, 100)]);
            });
        }
    }
    callbackref.current = handleRefresh;

    useEffect(() => {
        const id = setInterval(() => callbackref.current(false), 5000);
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
        <div className='send-container'>
            <Input value={editingMessage} onChange={e => setEditingMessage(e.target.value)} onPressEnter={handleSend} />
            <Button disabled={editingMessage.trim().length == 0} onClick={handleSend}>发送</Button>
        </div>
        <Messages messages={messages} />
    </>;
}

createRoot(document.querySelector('main')).render(<ConfigProvider autoInsertSpaceInButton={false}><App /></ConfigProvider>);
