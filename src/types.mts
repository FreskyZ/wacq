
interface CQEvent {
    time: number,
    self_id: number,
    post_type: 'message' | 'request' | 'notice' | 'meta_event',
    request_type?: string, // only when request
    notice_type?: string,  // only when notice
    // follows only when message
    // not a tagged union because other types are simple and not used
    message_type: 'group' | 'private',
    sub_type: 'friend' | 'group' | 'group_self' | 'other' | 'normal' | 'anonymous' | 'notice',
    message_id: number,
    user_id: number,
    message: any,
    raw_message: string,
    font: number,
    group_id: number,
    sender: MessageSender,
}

interface MessageSender {
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