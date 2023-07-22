/* eslint-disable @typescript-eslint/no-non-null-assertion */
import type { SubjectMessage } from '../../../tests/transport/SubjectInboundTransport'
import type { AskarWalletPostgresStorageConfig } from '../src/wallet'

import { Agent } from '@aries-framework/core'
import { Subject } from 'rxjs'

import { describeRunInNodeVersion } from '../../../tests/runInVersion'
import { SubjectInboundTransport } from '../../../tests/transport/SubjectInboundTransport'
import { SubjectOutboundTransport } from '../../../tests/transport/SubjectOutboundTransport'

import { e2eTest, getPostgresAgentOptions } from './helpers'

const storageConfig: AskarWalletPostgresStorageConfig = {
  type: 'postgres',
  config: {
    host: 'localhost:5432',
  },
  credentials: {
    account: 'postgres',
    password: 'postgres',
  },
}

const alicePostgresAgentOptions = getPostgresAgentOptions('AgentsAlice', storageConfig, {
  endpoints: ['rxjs:alice'],
})
const bobPostgresAgentOptions = getPostgresAgentOptions('AgentsBob', storageConfig, {
  endpoints: ['rxjs:bob'],
})

// FIXME: Re-include in tests when Askar NodeJS wrapper performance is improved
describeRunInNodeVersion([18], 'Askar Postgres agents', () => {
  let aliceAgent: Agent
  let bobAgent: Agent

  afterAll(async () => {
    if (bobAgent) {
      await bobAgent.shutdown()
      await bobAgent.wallet.delete()
    }

    if (aliceAgent) {
      await aliceAgent.shutdown()
      await aliceAgent.wallet.delete()
    }
  })

  test('Postgres Askar wallets E2E test', async () => {
    const aliceMessages = new Subject<SubjectMessage>()
    const bobMessages = new Subject<SubjectMessage>()

    const subjectMap = {
      'rxjs:alice': aliceMessages,
      'rxjs:bob': bobMessages,
    }

    aliceAgent = new Agent(alicePostgresAgentOptions)
    aliceAgent.registerInboundTransport(new SubjectInboundTransport(aliceMessages))
    aliceAgent.registerOutboundTransport(new SubjectOutboundTransport(subjectMap))
    await aliceAgent.initialize()

    bobAgent = new Agent(bobPostgresAgentOptions)
    bobAgent.registerInboundTransport(new SubjectInboundTransport(bobMessages))
    bobAgent.registerOutboundTransport(new SubjectOutboundTransport(subjectMap))
    await bobAgent.initialize()

    await e2eTest(aliceAgent, bobAgent)
  })
})
