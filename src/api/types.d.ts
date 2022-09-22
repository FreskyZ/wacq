
export interface Message {
    id?: number,
    // not returned in get group message
    // use in send group message
    groupId?: number,
    sender?: string,
    content: string,
}
