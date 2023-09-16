import type { MessageHandler, MessageHandlerInboundMessage } from '../../../../../agent/MessageHandler'
import type { V2DiscoverFeaturesService } from '../V2DiscoverFeaturesService'

import { V2DisclosuresMessage } from '../messages'
import { V2DisclosuresDidCommV2Message } from '../messages/V2DisclosuresDidCommV2Message'

export class V2DisclosuresMessageHandler implements MessageHandler {
  private discoverFeaturesService: V2DiscoverFeaturesService
  public supportedMessages = [V2DisclosuresMessage, V2DisclosuresDidCommV2Message]

  public constructor(discoverFeaturesService: V2DiscoverFeaturesService) {
    this.discoverFeaturesService = discoverFeaturesService
  }

  public async handle(inboundMessage: MessageHandlerInboundMessage<V2DisclosuresMessageHandler>) {
    await this.discoverFeaturesService.processDisclosure(inboundMessage)
  }
}
