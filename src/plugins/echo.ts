import { API } from '../core/index';
import type { CQMessageEvent } from '../core/base-types';

export class EchoPlugin {
    public constructor(
        private readonly api: API,
    ) {
        const atme = `[CQ:at,qq=${api.selfid}] `;
        api.on('message', (message: CQMessageEvent) => {
            if (message.self_id == api.selfid && message.group_id == api.groupid && message.message.startsWith(atme)) {
                api.send_group_message(api.groupid, `[CQ:at,qq=${message.user_id}] ${message.message.substring(atme.length)}`);
            }
        });
    }
}
