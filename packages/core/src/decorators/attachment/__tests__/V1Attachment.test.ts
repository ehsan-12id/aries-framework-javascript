import * as didJwsz6Mkf from '../../../crypto/__tests__/__fixtures__/didJwsz6Mkf'
import * as didJwsz6Mkv from '../../../crypto/__tests__/__fixtures__/didJwsz6Mkv'
import { JsonEncoder } from '../../../utils/JsonEncoder'
import { JsonTransformer } from '../../../utils/JsonTransformer'
import { V1Attachment, V1AttachmentData } from '../V1Attachment'

const mockJson = {
  '@id': 'ceffce22-6471-43e4-8945-b604091981c9',
  description: 'A small picture of a cat',
  filename: 'cat.png',
  'mime-type': 'text/plain',
  lastmod_time: new Date(),
  byte_count: 9200,
  data: {
    json: {
      hello: 'world!',
    },
    sha256: '00d7b2068a0b237f14a7979bbfc01ad62f60792e459467bfc4a7d3b9a6dbbe3e',
  },
}

const mockJsonBase64 = {
  '@id': 'ceffce22-6471-43e4-8945-b604091981c9',
  description: 'A small picture of a cat',
  filename: 'cat.png',
  'mime-type': 'text/plain',
  lastmod_time: new Date(),
  byte_count: 9200,
  data: {
    base64: JsonEncoder.toBase64(mockJson.data.json),
  },
}

const id = 'ceffce22-6471-43e4-8945-b604091981c9'
const description = 'A small picture of a cat'
const filename = 'cat.png'
const mimeType = 'text/plain'
const lastmodTime = new Date()
const byteCount = 9200
const data = {
  json: {
    hello: 'world!',
  },
  sha256: '00d7b2068a0b237f14a7979bbfc01ad62f60792e459467bfc4a7d3b9a6dbbe3e',
}
const dataInstance = new V1AttachmentData(data)

describe('Decorators | V1Attachment', () => {
  it('should correctly transform Json to V1Attachment class', () => {
    const decorator = JsonTransformer.fromJSON(mockJson, V1Attachment)

    expect(decorator.id).toBe(mockJson['@id'])
    expect(decorator.description).toBe(mockJson.description)
    expect(decorator.filename).toBe(mockJson.filename)
    expect(decorator.lastmodTime).toEqual(mockJson.lastmod_time)
    expect(decorator.byteCount).toEqual(mockJson.byte_count)
    expect(decorator.data).toMatchObject(mockJson.data)
  })

  it('should correctly transform V1Attachment class to Json', () => {
    const decorator = new V1Attachment({
      id,
      description,
      filename,
      mimeType,
      lastmodTime,
      byteCount,
      data: dataInstance,
    })

    const json = JsonTransformer.toJSON(decorator)
    const transformed = {
      '@id': id,
      description,
      filename,
      'mime-type': mimeType,
      lastmod_time: lastmodTime,
      byte_count: byteCount,
      data,
    }

    expect(json).toMatchObject(transformed)
  })

  it('should return the data correctly if only JSON exists', () => {
    const decorator = JsonTransformer.fromJSON(mockJson, V1Attachment)

    const gotData = decorator.getDataAsJson()
    expect(decorator.data.json).toEqual(gotData)
  })

  it('should return the data correctly if only Base64 exists', () => {
    const decorator = JsonTransformer.fromJSON(mockJsonBase64, V1Attachment)

    const gotData = decorator.getDataAsJson()
    expect(mockJson.data.json).toEqual(gotData)
  })

  describe('addJws', () => {
    it('correctly adds the jws to the data', async () => {
      const base64 = JsonEncoder.toBase64(didJwsz6Mkf.DATA_JSON)
      const attachment = new V1Attachment({
        id: 'some-uuid',
        data: new V1AttachmentData({
          base64,
        }),
      })

      expect(attachment.data.jws).toBeUndefined()

      attachment.addJws(didJwsz6Mkf.JWS_JSON)
      expect(attachment.data.jws).toEqual(didJwsz6Mkf.JWS_JSON)

      attachment.addJws(didJwsz6Mkv.JWS_JSON)
      expect(attachment.data.jws).toEqual({ signatures: [didJwsz6Mkf.JWS_JSON, didJwsz6Mkv.JWS_JSON] })

      expect(JsonTransformer.toJSON(attachment)).toMatchObject({
        '@id': 'some-uuid',
        data: {
          base64: JsonEncoder.toBase64(didJwsz6Mkf.DATA_JSON),
          jws: { signatures: [didJwsz6Mkf.JWS_JSON, didJwsz6Mkv.JWS_JSON] },
        },
      })
    })
  })
})