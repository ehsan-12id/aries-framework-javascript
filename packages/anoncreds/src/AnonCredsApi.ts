import type {
  AnonCredsCreateLinkSecretOptions,
  AnonCredsRegisterCredentialDefinitionOptions,
  AnonCredsRegisterRevocationRegistryDefinitionOptions,
  AnonCredsRegisterRevocationStatusListOptions,
  AnonCredsUpdateRevocationStatusListOptions,
} from './AnonCredsApiOptions'
import type {
  GetCredentialDefinitionReturn,
  GetRevocationStatusListReturn,
  GetRevocationRegistryDefinitionReturn,
  GetSchemaReturn,
  RegisterCredentialDefinitionReturn,
  RegisterSchemaOptions,
  RegisterSchemaReturn,
  AnonCredsRegistry,
  GetCredentialsOptions,
  RegisterRevocationRegistryDefinitionReturn,
  RegisterRevocationStatusListReturn,
} from './services'
import type { Extensible } from './services/registry/base'
import type { SimpleQuery } from '@aries-framework/core'

import { AgentContext, inject, injectable } from '@aries-framework/core'

import { AnonCredsModuleConfig } from './AnonCredsModuleConfig'
import { AnonCredsStoreRecordError } from './error'
import {
  AnonCredsRevocationRegistryDefinitionPrivateRecord,
  AnonCredsRevocationRegistryDefinitionPrivateRepository,
  AnonCredsRevocationRegistryDefinitionRepository,
  AnonCredsCredentialDefinitionPrivateRecord,
  AnonCredsCredentialDefinitionPrivateRepository,
  AnonCredsKeyCorrectnessProofRecord,
  AnonCredsKeyCorrectnessProofRepository,
  AnonCredsLinkSecretRecord,
  AnonCredsLinkSecretRepository,
  AnonCredsRevocationRegistryDefinitionRecord,
  AnonCredsRevocationStatusListRecord,
  AnonCredsRevocationStatusListRepository,
  RevocationRegistryState,
} from './repository'
import { AnonCredsCredentialDefinitionRecord } from './repository/AnonCredsCredentialDefinitionRecord'
import { AnonCredsCredentialDefinitionRepository } from './repository/AnonCredsCredentialDefinitionRepository'
import { AnonCredsSchemaRecord } from './repository/AnonCredsSchemaRecord'
import { AnonCredsSchemaRepository } from './repository/AnonCredsSchemaRepository'
import { AnonCredsCredentialDefinitionRecordMetadataKeys } from './repository/anonCredsCredentialDefinitionRecordMetadataTypes'
import { AnonCredsRevocationRegistryDefinitionRecordMetadataKeys } from './repository/anonCredsRevocationRegistryDefinitionRecordMetadataTypes'
import {
  AnonCredsHolderServiceSymbol,
  AnonCredsIssuerServiceSymbol,
  AnonCredsIssuerService,
  AnonCredsHolderService,
} from './services'
import { AnonCredsRegistryService } from './services/registry/AnonCredsRegistryService'
import { dateToTimestamp } from './utils/timestamp'

@injectable()
export class AnonCredsApi {
  public config: AnonCredsModuleConfig

  private agentContext: AgentContext
  private anonCredsRegistryService: AnonCredsRegistryService
  private anonCredsSchemaRepository: AnonCredsSchemaRepository
  private anonCredsCredentialDefinitionRepository: AnonCredsCredentialDefinitionRepository
  private anonCredsCredentialDefinitionPrivateRepository: AnonCredsCredentialDefinitionPrivateRepository
  private anonCredsRevocationRegistryDefinitionRepository: AnonCredsRevocationRegistryDefinitionRepository
  private anonCredsRevocationRegistryDefinitionPrivateRepository: AnonCredsRevocationRegistryDefinitionPrivateRepository
  private anonCredsRevocationStatusListRepository: AnonCredsRevocationStatusListRepository
  private anonCredsKeyCorrectnessProofRepository: AnonCredsKeyCorrectnessProofRepository
  private anonCredsLinkSecretRepository: AnonCredsLinkSecretRepository
  private anonCredsIssuerService: AnonCredsIssuerService
  private anonCredsHolderService: AnonCredsHolderService

  public constructor(
    agentContext: AgentContext,
    anonCredsRegistryService: AnonCredsRegistryService,
    config: AnonCredsModuleConfig,
    @inject(AnonCredsIssuerServiceSymbol) anonCredsIssuerService: AnonCredsIssuerService,
    @inject(AnonCredsHolderServiceSymbol) anonCredsHolderService: AnonCredsHolderService,
    anonCredsSchemaRepository: AnonCredsSchemaRepository,
    anonCredsRevocationStatusListRepository: AnonCredsRevocationStatusListRepository,
    anonCredsRevocationRegistryDefinitionRepository: AnonCredsRevocationRegistryDefinitionRepository,
    anonCredsRevocationRegistryDefinitionPrivateRepository: AnonCredsRevocationRegistryDefinitionPrivateRepository,
    anonCredsCredentialDefinitionRepository: AnonCredsCredentialDefinitionRepository,
    anonCredsCredentialDefinitionPrivateRepository: AnonCredsCredentialDefinitionPrivateRepository,
    anonCredsKeyCorrectnessProofRepository: AnonCredsKeyCorrectnessProofRepository,
    anonCredsLinkSecretRepository: AnonCredsLinkSecretRepository
  ) {
    this.agentContext = agentContext
    this.anonCredsRegistryService = anonCredsRegistryService
    this.config = config
    this.anonCredsIssuerService = anonCredsIssuerService
    this.anonCredsHolderService = anonCredsHolderService
    this.anonCredsSchemaRepository = anonCredsSchemaRepository
    this.anonCredsRevocationRegistryDefinitionRepository = anonCredsRevocationRegistryDefinitionRepository
    this.anonCredsRevocationRegistryDefinitionPrivateRepository = anonCredsRevocationRegistryDefinitionPrivateRepository
    this.anonCredsRevocationStatusListRepository = anonCredsRevocationStatusListRepository
    this.anonCredsCredentialDefinitionRepository = anonCredsCredentialDefinitionRepository
    this.anonCredsCredentialDefinitionPrivateRepository = anonCredsCredentialDefinitionPrivateRepository
    this.anonCredsKeyCorrectnessProofRepository = anonCredsKeyCorrectnessProofRepository
    this.anonCredsLinkSecretRepository = anonCredsLinkSecretRepository
  }

  /**
   * Create a Link Secret, optionally indicating its ID and if it will be the default one
   * If there is no default Link Secret, this will be set as default (even if setAsDefault is true).
   *
   */
  public async createLinkSecret(options?: AnonCredsCreateLinkSecretOptions) {
    const { linkSecretId, linkSecretValue } = await this.anonCredsHolderService.createLinkSecret(this.agentContext, {
      linkSecretId: options?.linkSecretId,
    })

    // In some cases we don't have the linkSecretValue. However we still want a record so we know which link secret ids are valid
    const linkSecretRecord = new AnonCredsLinkSecretRecord({ linkSecretId, value: linkSecretValue })

    // If it is the first link secret registered, set as default
    const defaultLinkSecretRecord = await this.anonCredsLinkSecretRepository.findDefault(this.agentContext)
    if (!defaultLinkSecretRecord || options?.setAsDefault) {
      linkSecretRecord.setTag('isDefault', true)
    }

    // Set the current default link secret as not default
    if (defaultLinkSecretRecord && options?.setAsDefault) {
      defaultLinkSecretRecord.setTag('isDefault', false)
      await this.anonCredsLinkSecretRepository.update(this.agentContext, defaultLinkSecretRecord)
    }

    await this.anonCredsLinkSecretRepository.save(this.agentContext, linkSecretRecord)
  }

  /**
   * Get a list of ids for the created link secrets
   */
  public async getLinkSecretIds(): Promise<string[]> {
    const linkSecrets = await this.anonCredsLinkSecretRepository.getAll(this.agentContext)

    return linkSecrets.map((linkSecret) => linkSecret.linkSecretId)
  }

  /**
   * Retrieve a {@link AnonCredsSchema} from the registry associated
   * with the {@link schemaId}
   */
  public async getSchema(schemaId: string): Promise<GetSchemaReturn> {
    const failedReturnBase = {
      resolutionMetadata: {
        error: 'error',
        message: `Unable to resolve schema ${schemaId}`,
      },
      schemaId,
      schemaMetadata: {},
    }

    const registry = this.findRegistryForIdentifier(schemaId)
    if (!registry) {
      failedReturnBase.resolutionMetadata.error = 'unsupportedAnonCredsMethod'
      failedReturnBase.resolutionMetadata.message = `Unable to resolve schema ${schemaId}: No registry found for identifier ${schemaId}`
      return failedReturnBase
    }

    try {
      const result = await registry.getSchema(this.agentContext, schemaId)
      return result
    } catch (error) {
      failedReturnBase.resolutionMetadata.message = `Unable to resolve schema ${schemaId}: ${error.message}`
      return failedReturnBase
    }
  }

  public async registerSchema(options: RegisterSchemaOptions): Promise<RegisterSchemaReturn> {
    const failedReturnBase = {
      schemaState: {
        state: 'failed' as const,
        schema: options.schema,
        reason: `Error registering schema for issuerId ${options.schema.issuerId}`,
      },
      registrationMetadata: {},
      schemaMetadata: {},
    }

    const registry = this.findRegistryForIdentifier(options.schema.issuerId)
    if (!registry) {
      failedReturnBase.schemaState.reason = `Unable to register schema. No registry found for issuerId ${options.schema.issuerId}`
      return failedReturnBase
    }

    try {
      const result = await registry.registerSchema(this.agentContext, options)
      await this.storeSchemaRecord(registry, result)

      return result
    } catch (error) {
      // Storage failed
      if (error instanceof AnonCredsStoreRecordError) {
        failedReturnBase.schemaState.reason = `Error storing schema record: ${error.message}`
        return failedReturnBase
      }

      // In theory registerSchema SHOULD NOT throw, but we can't know for sure
      failedReturnBase.schemaState.reason = `Error registering schema: ${error.message}`
      return failedReturnBase
    }
  }

  public async getCreatedSchemas(query: SimpleQuery<AnonCredsSchemaRecord>) {
    return this.anonCredsSchemaRepository.findByQuery(this.agentContext, query)
  }

  /**
   * Retrieve a {@link AnonCredsCredentialDefinition} from the registry associated
   * with the {@link credentialDefinitionId}
   */
  public async getCredentialDefinition(credentialDefinitionId: string): Promise<GetCredentialDefinitionReturn> {
    const failedReturnBase = {
      resolutionMetadata: {
        error: 'error',
        message: `Unable to resolve credential definition ${credentialDefinitionId}`,
      },
      credentialDefinitionId,
      credentialDefinitionMetadata: {},
    }

    const registry = this.findRegistryForIdentifier(credentialDefinitionId)
    if (!registry) {
      failedReturnBase.resolutionMetadata.error = 'unsupportedAnonCredsMethod'
      failedReturnBase.resolutionMetadata.message = `Unable to resolve credential definition ${credentialDefinitionId}: No registry found for identifier ${credentialDefinitionId}`
      return failedReturnBase
    }

    try {
      const result = await registry.getCredentialDefinition(this.agentContext, credentialDefinitionId)
      return result
    } catch (error) {
      failedReturnBase.resolutionMetadata.message = `Unable to resolve credential definition ${credentialDefinitionId}: ${error.message}`
      return failedReturnBase
    }
  }

  // TODO: Shall we store in Credential Definition Record the currently used revocation registry id? This can be used when accepting credential request to determine
  // Which one we'll need to use. It can be also a tag in RevocRegDef Record stating which one is the active one for a given CredDefId.

  public async registerCredentialDefinition(options: {
    credentialDefinition: AnonCredsRegisterCredentialDefinitionOptions
    options: Extensible
  }): Promise<RegisterCredentialDefinitionReturn> {
    const failedReturnBase = {
      credentialDefinitionState: {
        state: 'failed' as const,
        reason: `Error registering credential definition for issuerId ${options.credentialDefinition.issuerId}`,
      },
      registrationMetadata: {},
      credentialDefinitionMetadata: {},
    }

    const registry = this.findRegistryForIdentifier(options.credentialDefinition.issuerId)
    if (!registry) {
      failedReturnBase.credentialDefinitionState.reason = `Unable to register credential definition. No registry found for issuerId ${options.credentialDefinition.issuerId}`
      return failedReturnBase
    }

    const schemaRegistry = this.findRegistryForIdentifier(options.credentialDefinition.schemaId)
    if (!schemaRegistry) {
      failedReturnBase.credentialDefinitionState.reason = `Unable to register credential definition. No registry found for schemaId ${options.credentialDefinition.schemaId}`
      return failedReturnBase
    }

    try {
      const schemaResult = await schemaRegistry.getSchema(this.agentContext, options.credentialDefinition.schemaId)

      if (!schemaResult.schema) {
        failedReturnBase.credentialDefinitionState.reason = `error resolving schema with id ${options.credentialDefinition.schemaId}: ${schemaResult.resolutionMetadata.error} ${schemaResult.resolutionMetadata.message}`
        return failedReturnBase
      }

      const { credentialDefinition, credentialDefinitionPrivate, keyCorrectnessProof } =
        await this.anonCredsIssuerService.createCredentialDefinition(
          this.agentContext,
          {
            issuerId: options.credentialDefinition.issuerId,
            schemaId: options.credentialDefinition.schemaId,
            tag: options.credentialDefinition.tag ?? 'default',
            supportRevocation: options.credentialDefinition.supportRevocation ?? false,
            schema: schemaResult.schema,
          },
          // FIXME: Indy SDK requires the schema seq no to be passed in here. This is not ideal.
          {
            indyLedgerSchemaSeqNo: schemaResult.schemaMetadata.indyLedgerSeqNo,
          }
        )

      const result = await registry.registerCredentialDefinition(this.agentContext, {
        credentialDefinition,
        options: {},
      })

      await this.storeCredentialDefinitionRecord(registry, result, credentialDefinitionPrivate, keyCorrectnessProof)

      return result
    } catch (error) {
      // Storage failed
      if (error instanceof AnonCredsStoreRecordError) {
        failedReturnBase.credentialDefinitionState.reason = `Error storing credential definition records: ${error.message}`
        return failedReturnBase
      }

      // In theory registerCredentialDefinition SHOULD NOT throw, but we can't know for sure
      failedReturnBase.credentialDefinitionState.reason = `Error registering credential definition: ${error.message}`
      return failedReturnBase
    }
  }

  public async getCreatedCredentialDefinitions(query: SimpleQuery<AnonCredsCredentialDefinitionRecord>) {
    return this.anonCredsCredentialDefinitionRepository.findByQuery(this.agentContext, query)
  }

  /**
   * Retrieve a {@link AnonCredsRevocationRegistryDefinition} from the registry associated
   * with the {@link revocationRegistryDefinitionId}
   */
  public async getRevocationRegistryDefinition(
    revocationRegistryDefinitionId: string
  ): Promise<GetRevocationRegistryDefinitionReturn> {
    const failedReturnBase = {
      resolutionMetadata: {
        error: 'error',
        message: `Unable to resolve revocation registry ${revocationRegistryDefinitionId}`,
      },
      revocationRegistryDefinitionId,
      revocationRegistryDefinitionMetadata: {},
    }

    const registry = this.findRegistryForIdentifier(revocationRegistryDefinitionId)
    if (!registry) {
      failedReturnBase.resolutionMetadata.error = 'unsupportedAnonCredsMethod'
      failedReturnBase.resolutionMetadata.message = `Unable to resolve revocation registry ${revocationRegistryDefinitionId}: No registry found for identifier ${revocationRegistryDefinitionId}`
      return failedReturnBase
    }

    try {
      const result = await registry.getRevocationRegistryDefinition(this.agentContext, revocationRegistryDefinitionId)
      return result
    } catch (error) {
      failedReturnBase.resolutionMetadata.message = `Unable to resolve revocation registry ${revocationRegistryDefinitionId}: ${error.message}`
      return failedReturnBase
    }
  }

  public async registerRevocationRegistryDefinition(options: {
    revocationRegistryDefinition: AnonCredsRegisterRevocationRegistryDefinitionOptions
    options: Extensible
  }): Promise<RegisterRevocationRegistryDefinitionReturn> {
    const { issuerId, tag, credentialDefinitionId, maximumCredentialNumber } = options.revocationRegistryDefinition

    const tailsFileService =
      this.agentContext.dependencyManager.resolve<AnonCredsModuleConfig>(AnonCredsModuleConfig).tailsFileService

    const tailsDirectoryPath = await tailsFileService.getTailsBasePath(this.agentContext)

    const failedReturnBase = {
      revocationRegistryDefinitionState: {
        state: 'failed' as const,
        reason: `Error registering revocation registry definition for issuerId ${issuerId}`,
      },
      registrationMetadata: {},
      revocationRegistryDefinitionMetadata: {},
    }

    const registry = this.findRegistryForIdentifier(issuerId)
    if (!registry) {
      failedReturnBase.revocationRegistryDefinitionState.reason = `Unable to register revocation registry definition. No registry found for issuerId ${issuerId}`
      return failedReturnBase
    }

    const { credentialDefinition } = await registry.getCredentialDefinition(this.agentContext, credentialDefinitionId)

    if (!credentialDefinition) {
      failedReturnBase.revocationRegistryDefinitionState.reason = `Unable to register revocation registry definition. No credential definition found for id ${credentialDefinitionId}`
      return failedReturnBase
    }
    try {
      const { revocationRegistryDefinition, revocationRegistryDefinitionPrivate } =
        await this.anonCredsIssuerService.createRevocationRegistryDefinition(this.agentContext, {
          issuerId,
          tag,
          credentialDefinitionId,
          credentialDefinition,
          maximumCredentialNumber,
          tailsDirectoryPath,
        })

      // At this moment, tails file should be published and a valid public URL will be received
      const localTailsLocation = revocationRegistryDefinition.value.tailsLocation

      revocationRegistryDefinition.value.tailsLocation = await tailsFileService.uploadTailsFile(this.agentContext, {
        revocationRegistryDefinition,
      })

      const result = await registry.registerRevocationRegistryDefinition(this.agentContext, {
        revocationRegistryDefinition,
        options: {},
      })
      await this.storeRevocationRegistryDefinitionRecord(result, revocationRegistryDefinitionPrivate)

      return {
        ...result,
        revocationRegistryDefinitionMetadata: { ...result.revocationRegistryDefinitionMetadata, localTailsLocation },
      }
    } catch (error) {
      // Storage failed
      if (error instanceof AnonCredsStoreRecordError) {
        failedReturnBase.revocationRegistryDefinitionState.reason = `Error storing revocation registry definition records: ${error.message}`
        return failedReturnBase
      }

      failedReturnBase.revocationRegistryDefinitionState.reason = `Error registering revocation registry definition: ${error.message}`
      return failedReturnBase
    }
  }

  /**
   * Retrieve the {@link AnonCredsRevocationStatusList} for the given {@link timestamp} from the registry associated
   * with the {@link revocationRegistryDefinitionId}
   */
  public async getRevocationStatusList(
    revocationRegistryDefinitionId: string,
    timestamp: number
  ): Promise<GetRevocationStatusListReturn> {
    const failedReturnBase = {
      resolutionMetadata: {
        error: 'error',
        message: `Unable to resolve revocation status list for revocation registry ${revocationRegistryDefinitionId}`,
      },
      revocationStatusListMetadata: {},
    }

    const registry = this.findRegistryForIdentifier(revocationRegistryDefinitionId)
    if (!registry) {
      failedReturnBase.resolutionMetadata.error = 'unsupportedAnonCredsMethod'
      failedReturnBase.resolutionMetadata.message = `Unable to resolve revocation status list for revocation registry ${revocationRegistryDefinitionId}: No registry found for identifier ${revocationRegistryDefinitionId}`
      return failedReturnBase
    }

    try {
      const result = await registry.getRevocationStatusList(
        this.agentContext,
        revocationRegistryDefinitionId,
        timestamp
      )
      return result
    } catch (error) {
      failedReturnBase.resolutionMetadata.message = `Unable to resolve revocation status list for revocation registry ${revocationRegistryDefinitionId}: ${error.message}`
      return failedReturnBase
    }
  }

  public async registerRevocationStatusList(options: {
    revocationStatusList: AnonCredsRegisterRevocationStatusListOptions
    options: Extensible
  }): Promise<RegisterRevocationStatusListReturn> {
    const { issuanceByDefault, issuerId, revocationRegistryDefinitionId } = options.revocationStatusList

    const failedReturnBase = {
      revocationStatusListState: {
        state: 'failed' as const,
        reason: `Error registering revocation status list for issuerId ${issuerId}`,
      },
      registrationMetadata: {},
      revocationStatusListMetadata: {},
    }

    const registry = this.findRegistryForIdentifier(issuerId)
    if (!registry) {
      failedReturnBase.revocationStatusListState.reason = `Unable to register revocation status list. No registry found for issuerId ${issuerId}`
      return failedReturnBase
    }

    const { revocationRegistryDefinition } = await registry.getRevocationRegistryDefinition(
      this.agentContext,
      revocationRegistryDefinitionId
    )

    if (!revocationRegistryDefinition) {
      failedReturnBase.revocationStatusListState.reason = `Unable to register revocation status list. No revocation registry definition found for ${revocationRegistryDefinitionId}`
      return failedReturnBase
    }
    const tailsFileService = this.agentContext.dependencyManager.resolve(AnonCredsModuleConfig).tailsFileService
    const { tailsFilePath } = await tailsFileService.downloadTailsFile(this.agentContext, {
      revocationRegistryDefinition,
    })

    try {
      const revocationStatusList = await this.anonCredsIssuerService.createRevocationStatusList(this.agentContext, {
        issuanceByDefault,
        issuerId,
        revocationRegistryDefinition,
        revocationRegistryDefinitionId,
        tailsFilePath,
      })

      const result = await registry.registerRevocationStatusList(this.agentContext, {
        revocationStatusList,
        options: {},
      })

      await this.storeRevocationStatusListRecord(result, revocationRegistryDefinition.credDefId)

      return result
    } catch (error) {
      // Storage failed
      if (error instanceof AnonCredsStoreRecordError) {
        failedReturnBase.revocationStatusListState.reason = `Error storing revocation status list records: ${error.message}`
        return failedReturnBase
      }

      failedReturnBase.revocationStatusListState.reason = `Error registering revocation status list: ${error.message}`
      return failedReturnBase
    }
  }

  public async updateRevocationStatusList(
    options: AnonCredsUpdateRevocationStatusListOptions
  ): Promise<RegisterRevocationStatusListReturn> {
    const { issuedCredentialIndexes, revokedCredentialIndexes, revocationRegistryDefinitionId } = options

    const failedReturnBase = {
      revocationStatusListState: {
        state: 'failed' as const,
        reason: `Error updating revocation status list for revocation registry definition id ${options.revocationRegistryDefinitionId}`,
      },
      registrationMetadata: {},
      revocationStatusListMetadata: {},
    }

    const registry = this.findRegistryForIdentifier(options.revocationRegistryDefinitionId)
    if (!registry) {
      failedReturnBase.revocationStatusListState.reason = `Unable to update revocation status list. No registry found for id ${options.revocationRegistryDefinitionId}`
      return failedReturnBase
    }

    const { revocationRegistryDefinition } = await registry.getRevocationRegistryDefinition(
      this.agentContext,
      revocationRegistryDefinitionId
    )

    if (!revocationRegistryDefinition) {
      failedReturnBase.revocationStatusListState.reason = `Unable to update revocation status list. No revocation registry definition found for ${revocationRegistryDefinitionId}`
      return failedReturnBase
    }

    const { revocationStatusList: previousRevocationStatusList } = await this.getRevocationStatusList(
      revocationRegistryDefinitionId,
      dateToTimestamp(new Date())
    )

    if (!previousRevocationStatusList) {
      failedReturnBase.revocationStatusListState.reason = `Unable to update revocation status list. No previous revocation status list found for ${options.revocationRegistryDefinitionId}`
      return failedReturnBase
    }

    const tailsFileService = this.agentContext.dependencyManager.resolve(AnonCredsModuleConfig).tailsFileService
    const { tailsFilePath } = await tailsFileService.downloadTailsFile(this.agentContext, {
      revocationRegistryDefinition,
    })

    try {
      const revocationStatusList = await this.anonCredsIssuerService.updateRevocationStatusList(this.agentContext, {
        issued: issuedCredentialIndexes,
        revoked: revokedCredentialIndexes,
        revocationStatusList: previousRevocationStatusList,
        revocationRegistryDefinition,
        tailsFilePath,
      })

      const result = await registry.registerRevocationStatusList(this.agentContext, {
        revocationStatusList,
        options: {},
      })

      await this.storeRevocationStatusListRecord(result, revocationRegistryDefinition.credDefId)

      return result
    } catch (error) {
      // Storage failed
      if (error instanceof AnonCredsStoreRecordError) {
        failedReturnBase.revocationStatusListState.reason = `Error storing revocation status list records: ${error.message}`
        return failedReturnBase
      }

      failedReturnBase.revocationStatusListState.reason = `Error registering revocation status list: ${error.message}`
      return failedReturnBase
    }
  }

  public async getCredential(credentialId: string) {
    return this.anonCredsHolderService.getCredential(this.agentContext, { credentialId })
  }

  public async getCredentials(options: GetCredentialsOptions) {
    return this.anonCredsHolderService.getCredentials(this.agentContext, options)
  }

  private async storeRevocationRegistryDefinitionRecord(
    result: RegisterRevocationRegistryDefinitionReturn,
    revocationRegistryDefinitionPrivate?: Record<string, unknown>
  ): Promise<void> {
    try {
      // If we have both the revocationRegistryDefinition and the revocationRegistryDefinitionId we will store a copy
      // of the credential definition. We may need to handle an edge case in the future where we e.g. don't have the
      // id yet, and it is registered through a different channel
      if (
        result.revocationRegistryDefinitionState.revocationRegistryDefinition &&
        result.revocationRegistryDefinitionState.revocationRegistryDefinitionId
      ) {
        const revocationRegistryDefinitionRecord = new AnonCredsRevocationRegistryDefinitionRecord({
          revocationRegistryDefinitionId: result.revocationRegistryDefinitionState.revocationRegistryDefinitionId,
          revocationRegistryDefinition: result.revocationRegistryDefinitionState.revocationRegistryDefinition,
        })

        // TODO: do we need to store this metadata? For indy, the registration metadata contains e.g.
        // the indyLedgerSeqNo and the didIndyNamespace, but it can get quite big if complete transactions
        // are stored in the metadata
        revocationRegistryDefinitionRecord.metadata.set(
          AnonCredsRevocationRegistryDefinitionRecordMetadataKeys.RevocationRegistryDefinitionMetadata,
          result.revocationRegistryDefinitionMetadata
        )
        revocationRegistryDefinitionRecord.metadata.set(
          AnonCredsRevocationRegistryDefinitionRecordMetadataKeys.RevocationRegistryDefinitionRegistrationMetadata,
          result.registrationMetadata
        )

        await this.anonCredsRevocationRegistryDefinitionRepository.save(
          this.agentContext,
          revocationRegistryDefinitionRecord
        )

        // Store Revocation Registry Definition private data (if provided by issuer service)
        if (revocationRegistryDefinitionPrivate) {
          const revocationRegistryDefinitionPrivateRecord = new AnonCredsRevocationRegistryDefinitionPrivateRecord({
            revocationRegistryDefinitionId: result.revocationRegistryDefinitionState.revocationRegistryDefinitionId,
            credentialDefinitionId: result.revocationRegistryDefinitionState.revocationRegistryDefinition.credDefId,
            value: revocationRegistryDefinitionPrivate,
            state: RevocationRegistryState.Active,
          })
          await this.anonCredsRevocationRegistryDefinitionPrivateRepository.save(
            this.agentContext,
            revocationRegistryDefinitionPrivateRecord
          )
        }
      }
    } catch (error) {
      throw new AnonCredsStoreRecordError(`Error storing revocation registry definition records`, { cause: error })
    }
  }

  private async storeRevocationStatusListRecord(
    result: RegisterRevocationStatusListReturn,
    credentialDefinitionId: string
  ): Promise<void> {
    try {
      if (result.revocationStatusListState.revocationStatusList && result.revocationStatusListState.timestamp) {
        const revocationStatusListRecord = new AnonCredsRevocationStatusListRecord({
          revocationStatusList: result.revocationStatusListState.revocationStatusList,
          credentialDefinitionId,
        })

        await this.anonCredsRevocationStatusListRepository.save(this.agentContext, revocationStatusListRecord)
      }
    } catch (error) {
      throw new AnonCredsStoreRecordError(`Error storing revocation status list record`, { cause: error })
    }
  }

  private async storeCredentialDefinitionRecord(
    registry: AnonCredsRegistry,
    result: RegisterCredentialDefinitionReturn,
    credentialDefinitionPrivate?: Record<string, unknown>,
    keyCorrectnessProof?: Record<string, unknown>
  ): Promise<void> {
    try {
      // If we have both the credentialDefinition and the credentialDefinitionId we will store a copy of the credential definition. We may need to handle an
      // edge case in the future where we e.g. don't have the id yet, and it is registered through a different channel
      if (
        result.credentialDefinitionState.credentialDefinition &&
        result.credentialDefinitionState.credentialDefinitionId
      ) {
        const credentialDefinitionRecord = new AnonCredsCredentialDefinitionRecord({
          credentialDefinitionId: result.credentialDefinitionState.credentialDefinitionId,
          credentialDefinition: result.credentialDefinitionState.credentialDefinition,
          methodName: registry.methodName,
        })

        // TODO: do we need to store this metadata? For indy, the registration metadata contains e.g.
        // the indyLedgerSeqNo and the didIndyNamespace, but it can get quite big if complete transactions
        // are stored in the metadata
        credentialDefinitionRecord.metadata.set(
          AnonCredsCredentialDefinitionRecordMetadataKeys.CredentialDefinitionMetadata,
          result.credentialDefinitionMetadata
        )
        credentialDefinitionRecord.metadata.set(
          AnonCredsCredentialDefinitionRecordMetadataKeys.CredentialDefinitionRegistrationMetadata,
          result.registrationMetadata
        )

        await this.anonCredsCredentialDefinitionRepository.save(this.agentContext, credentialDefinitionRecord)

        // Store Credential Definition private data (if provided by issuer service)
        if (credentialDefinitionPrivate) {
          const credentialDefinitionPrivateRecord = new AnonCredsCredentialDefinitionPrivateRecord({
            credentialDefinitionId: result.credentialDefinitionState.credentialDefinitionId,
            value: credentialDefinitionPrivate,
          })
          await this.anonCredsCredentialDefinitionPrivateRepository.save(
            this.agentContext,
            credentialDefinitionPrivateRecord
          )
        }

        if (keyCorrectnessProof) {
          const keyCorrectnessProofRecord = new AnonCredsKeyCorrectnessProofRecord({
            credentialDefinitionId: result.credentialDefinitionState.credentialDefinitionId,
            value: keyCorrectnessProof,
          })
          await this.anonCredsKeyCorrectnessProofRepository.save(this.agentContext, keyCorrectnessProofRecord)
        }
      }
    } catch (error) {
      throw new AnonCredsStoreRecordError(`Error storing credential definition records`, { cause: error })
    }
  }

  private async storeSchemaRecord(registry: AnonCredsRegistry, result: RegisterSchemaReturn): Promise<void> {
    try {
      // If we have both the schema and the schemaId we will store a copy of the schema. We may need to handle an
      // edge case in the future where we e.g. don't have the id yet, and it is registered through a different channel
      if (result.schemaState.schema && result.schemaState.schemaId) {
        const schemaRecord = new AnonCredsSchemaRecord({
          schemaId: result.schemaState.schemaId,
          schema: result.schemaState.schema,
          methodName: registry.methodName,
        })

        await this.anonCredsSchemaRepository.save(this.agentContext, schemaRecord)
      }
    } catch (error) {
      throw new AnonCredsStoreRecordError(`Error storing schema record`, { cause: error })
    }
  }

  private findRegistryForIdentifier(identifier: string) {
    try {
      return this.anonCredsRegistryService.getRegistryForIdentifier(this.agentContext, identifier)
    } catch {
      return null
    }
  }
}
