import { query } from '../adk/database';
import { setupAPIServer, shutdownAPIServer } from '../adk/api-server'
import { dispatch as dispatchImpl } from "../api/server";
import type * as api from '../api/types';
import { log } from './logger';
import { backend } from './backend';

// web interface implementations, currently they fit in one file

export interface DBMessage {
    Id: number,
    Time: string,
    UserId: number,
    UserName: string,
    NickName: string,
    Content: string,
}

async function getRecentGroups() {
    const { value }: { value: { GroupId: number }[] } = await query('SELECT DISTINCT `GroupId` FROM `Message202209` WHERE `GroupId` IS NOT NULL;');
    return value.map(v => v.GroupId);
}
async function getRecentPrivates() {
    return [2];
}
async function getGroupRecentMessages(groupId: number): Promise<api.Message[]> {
    // I completely don't understand why if missing the type assertion,
    // mouse hover, cursor stop (highlight property def and use) and akari work correctly for 'value' variable but still gives red underline
    const { value }: { value: DBMessage[] } = await query<DBMessage[]>(
        'SELECT `Id`, `Time`, `UserId`, `UserName`, `NickName`, `Content` FROM `Message202209` WHERE `GroupId` = ? ORDER BY `Time` DESC LIMIT 100;', groupId);
    return value.map<api.Message>(m => ({ id: m.Id, sender: `${m.NickName || m.UserName} (${m.UserId}, ${m.UserName}) at ${m.Time}`, content: m.Content }));
}
async function getPrivateRecentMessages(): Promise<api.Message[]> {
    return [];
}
async function sendGroupMessage(message: api.Message) {
    backend.call('send_group_msg', { group_id: message.groupId, message: message.content });
    return message;
}
async function sendPrivateMessage(message: api.Message) {
    return message;
}

function handleError(kind: string, error: any) {
    log.error(`${kind}: ${error}`);
}

export function setupWebInterface(socketpath: string) {
    setupAPIServer(socketpath, handleError, x => dispatchImpl(x, {
        default: { getRecentGroups, getRecentPrivates, getGroupRecentMessages, getPrivateRecentMessages, sendGroupMessage, sendPrivateMessage },
    }));
}
export function shutdownWebInterface() {
    shutdownAPIServer(handleError);
}
