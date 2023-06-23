
export interface Message {
    id?: number,
    // timestamp (second)
    time?: number,
    // not returned in get group message
    // use in send group message
    groupId?: number,
    // send private message's target id TODO naming
    userId?: number,
    sender?: string,
    content: string,
}
