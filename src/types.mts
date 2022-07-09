
export interface CQMetaEvent {
    time: number,
    self_id: number,
    post_type: 'meta_event',
    meta_event_type: string,
}

export interface CQRequestEvent {
    time: number,
    self_id: number,
    post_type: 'request',
    request_type: string, 
}

export interface CQNoticeEvent {
    time: number,
    self_id: number,
    post_type: 'notice',
    notice_type: string,
}

export interface CQMessageEvent {
    time: number,
    self_id: number,
    post_type: 'message',
    message_type: 'group' | 'private',
    sub_type: 'friend' | 'group' | 'group_self' | 'other' | 'normal' | 'anonymous' | 'notice',
    message_id: number,
    user_id: number,
    message: string,
    raw_message: string,
    font: number,
    group_id: number,
    sender: CQMessageSender,
}

export interface CQMessageSender {
    user_id: number,
    nickname: string,
    sex: string,
    age: number,
    card?: string, // nickname in group
    area?: string,
    level?: string,
    role?: string,
    title?: string,
}

export interface CQResponseOkEvent {
    status: 'ok',
    retcode: 0,
    data: any,
    echo?: string,
}

export interface CQResponseAsyncEvent {
    status: 'async',
    retcode: 1,
    echo?: string,
}

export interface CQResponseFailedEvent {
    status: 'failed',
    retcode: number,
    msg: string,
    workding: string,
    data: any,
    echo?: string,
}

export type CQResponseEvent = CQResponseOkEvent | CQResponseAsyncEvent | CQResponseFailedEvent;
export type CQEvent = CQMetaEvent | CQRequestEvent | CQNoticeEvent | CQMessageEvent | CQResponseEvent;
