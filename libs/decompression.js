// Some synchronous functions.

/* ***** DECRYPTION ***** */
function aesDecrypt (ctx, buf, length) {
    for (let i = 0; i < length; i += 16) {
        let storeNextIv = buf.slice(i, i + 16)

        let state = []
        for (let j = 0; j < 4; j++) {
            state.push([])
            for (let k = 0; k < 4; k++) state[j].push(buf[i + (j * 4) + k])
        }

        aesAddRoundKey(10, state, ctx.roundKey)

        for (let round = 10 - 1; round > 0; round--) {
            aesInvShiftRows(state)
            aesInvSubBytes(state)
            aesAddRoundKey(round, state, ctx.roundKey)
            aesInvMixColumns(state)
        }
        
        aesInvShiftRows(state)
        aesInvSubBytes(state)
        aesAddRoundKey(0, state, ctx.roundKey)

        for (let j = 0; j < 4; j++) {
            for (let k = 0; k < 4; k++) buf[i + (j * 4) + k] = state[j][k]
        }

        aesXorWithIv(buf, i, ctx.iv)
        ctx.iv = storeNextIv
    }
}
function aesInvSubBytes (state) {
    for (let i = 0; i < 4; i++) {
        for (let j = 0; j < 4; j++) state[i][j] = aesRsbox[state[i][j]]
    }
}
function aesInvShiftRows (state) {
    let temp = 0

    temp        = state[3][1]
    state[3][1] = state[2][1]
    state[2][1] = state[1][1]
    state[1][1] = state[0][1]
    state[0][1] = temp

    temp        = state[0][2]
    state[0][2] = state[2][2]
    state[2][2] = temp
    temp        = state[1][2]
    state[1][2] = state[3][2]
    state[3][2] = temp

    temp        = state[0][3]
    state[0][3] = state[1][3]
    state[1][3] = state[2][3]
    state[2][3] = state[3][3]
    state[3][3] = temp
}
function aesInvMixColumns (state) {
    for (let i = 0; i < 4; i++) {
        let a = state[i][0]
        let b = state[i][1]
        let c = state[i][2]
        let d = state[i][3]

        state[i][0] = (aesMultiply(a, 0x0e) ^ aesMultiply(b, 0x0b) ^ aesMultiply(c, 0x0d) ^ aesMultiply(d, 0x09)) & 0xFF
        state[i][1] = (aesMultiply(a, 0x09) ^ aesMultiply(b, 0x0e) ^ aesMultiply(c, 0x0b) ^ aesMultiply(d, 0x0d)) & 0xFF
        state[i][2] = (aesMultiply(a, 0x0d) ^ aesMultiply(b, 0x09) ^ aesMultiply(c, 0x0e) ^ aesMultiply(d, 0x0b)) & 0xFF
        state[i][3] = (aesMultiply(a, 0x0b) ^ aesMultiply(b, 0x0d) ^ aesMultiply(c, 0x09) ^ aesMultiply(d, 0x0e)) & 0xFF
    }
}

/* ***** ENCRYPTION ***** */
function aesEncrypt (ctx, buf, length) {
    let iv = ctx.iv
    for (let i = 0; i < length; i += 16) {
        aesXorWithIv(buf, i, iv)
        
        let state = []
        for (let j = 0; j < 4; j++) {
            state.push([])
            for (let k = 0; k < 4; k++) state[j].push(buf[i + (j * 4) + k])
        }

        aesAddRoundKey(0, state, ctx.roundKey)

        for (let round = 1; round < 10; round++) {
            aesSubBytes(state)
            aesShiftRows(state)
            aesMixColumns(state)
            aesAddRoundKey(round, state, ctx.roundKey)
        }

        aesSubBytes(state)
        aesShiftRows(state)
        aesAddRoundKey(10, state, ctx.roundKey)

        for (let j = 0; j < 4; j++) {
            for (let k = 0; k < 4; k++) buf[i + (j * 4) + k] = state[j][k]
        }
        
        iv = buf.slice(i, i + 16)
    }
    ctx.iv = iv
}
function aesSubBytes (state) {
    for (let i = 0; i < 4; i++) {
        for (let j = 0; j < 4; j++) state[i][j] = aesSbox[state[i][j]]
    }
}
function aesShiftRows (state) {
    let temp = 0

    temp        = state[0][1]
    state[0][1] = state[1][1]
    state[1][1] = state[2][1]
    state[2][1] = state[3][1]
    state[3][1] = temp

    temp        = state[0][2]
    state[0][2] = state[2][2]
    state[2][2] = temp
    temp        = state[1][2]
    state[1][2] = state[3][2]
    state[3][2] = temp

    temp        = state[0][3]
    state[0][3] = state[3][3]
    state[3][3] = state[2][3]
    state[2][3] = state[1][3]
    state[1][3] = temp
}
function aesMixColumns (state) {
    let temp1 = 0
    let temp2 = 0
    let temp3 = 0
    for (let i = 0; i < 4; i++) {
        temp3 = state[i][0]
        temp1 = state[i][0] ^ state[i][1] ^              state[i][2] ^ state[i][3]
        temp2 = state[i][0] ^ state[i][1] ; temp2 = aesXTimes(temp2) ; state[i][0] ^= temp2 ^ temp1
        temp2 = state[i][1] ^ state[i][2] ; temp2 = aesXTimes(temp2) ; state[i][1] ^= temp2 ^ temp1
        temp2 = state[i][2] ^ state[i][3] ; temp2 = aesXTimes(temp2) ; state[i][2] ^= temp2 ^ temp1
        temp2 = state[i][3] ^       temp3 ; temp2 = aesXTimes(temp2) ; state[i][3] ^= temp2 ^ temp1
    }
}

/* ***** DECRYPTION/ENCRYPTION ***** */
const aesSbox = [
    0x63, 0x7C, 0x77, 0x7B, 0xF2, 0x6B, 0x6F, 0xC5, 0x30, 0x01, 0x67, 0x2B, 0xFE, 0xD7, 0xAB, 0x76,
    0xCA, 0x82, 0xC9, 0x7D, 0xFA, 0x59, 0x47, 0xF0, 0xAD, 0xD4, 0xA2, 0xAF, 0x9C, 0xA4, 0x72, 0xC0,
    0xB7, 0xFD, 0x93, 0x26, 0x36, 0x3F, 0xF7, 0xCC, 0x34, 0xA5, 0xE5, 0xF1, 0x71, 0xD8, 0x31, 0x15,
    0x04, 0xC7, 0x23, 0xC3, 0x18, 0x96, 0x05, 0x9A, 0x07, 0x12, 0x80, 0xE2, 0xEB, 0x27, 0xB2, 0x75,
    0x09, 0x83, 0x2C, 0x1A, 0x1B, 0x6E, 0x5A, 0xA0, 0x52, 0x3B, 0xD6, 0xB3, 0x29, 0xE3, 0x2F, 0x84,
    0x53, 0xD1, 0x00, 0xED, 0x20, 0xFC, 0xB1, 0x5B, 0x6A, 0xCB, 0xBE, 0x39, 0x4A, 0x4C, 0x58, 0xCF,
    0xD0, 0xEF, 0xAA, 0xFB, 0x43, 0x4D, 0x33, 0x85, 0x45, 0xF9, 0x02, 0x7F, 0x50, 0x3C, 0x9F, 0xA8,
    0x51, 0xA3, 0x40, 0x8F, 0x92, 0x9D, 0x38, 0xF5, 0xBC, 0xB6, 0xDA, 0x21, 0x10, 0xFF, 0xF3, 0xD2,
    0xCD, 0x0C, 0x13, 0xEC, 0x5F, 0x97, 0x44, 0x17, 0xC4, 0xA7, 0x7E, 0x3D, 0x64, 0x5D, 0x19, 0x73,
    0x60, 0x81, 0x4F, 0xDC, 0x22, 0x2A, 0x90, 0x88, 0x46, 0xEE, 0xB8, 0x14, 0xDE, 0x5E, 0x0B, 0xDB,
    0xE0, 0x32, 0x3A, 0x0A, 0x49, 0x06, 0x24, 0x5C, 0xC2, 0xD3, 0xAC, 0x62, 0x91, 0x95, 0xE4, 0x79,
    0xE7, 0xC8, 0x37, 0x6D, 0x8D, 0xD5, 0x4E, 0xA9, 0x6C, 0x56, 0xF4, 0xEA, 0x65, 0x7A, 0xAE, 0x08,
    0xBA, 0x78, 0x25, 0x2E, 0x1C, 0xA6, 0xB4, 0xC6, 0xE8, 0xDD, 0x74, 0x1F, 0x4B, 0xBD, 0x8B, 0x8A,
    0x70, 0x3E, 0xB5, 0x66, 0x48, 0x03, 0xF6, 0x0E, 0x61, 0x35, 0x57, 0xB9, 0x86, 0xC1, 0x1D, 0x9E,
    0xE1, 0xF8, 0x98, 0x11, 0x69, 0xD9, 0x8E, 0x94, 0x9B, 0x1E, 0x87, 0xE9, 0xCE, 0x55, 0x28, 0xDF,
    0x8C, 0xA1, 0x89, 0x0D, 0xBF, 0xE6, 0x42, 0x68, 0x41, 0x99, 0x2D, 0x0F, 0xB0, 0x54, 0xBB, 0x16,
]
const aesRsbox = [
    0x52, 0x09, 0x6A, 0xD5, 0x30, 0x36, 0xA5, 0x38, 0xBF, 0x40, 0xA3, 0x9E, 0x81, 0xF3, 0xD7, 0xFB,
    0x7C, 0xE3, 0x39, 0x82, 0x9B, 0x2F, 0xFF, 0x87, 0x34, 0x8E, 0x43, 0x44, 0xC4, 0xDE, 0xE9, 0xCB,
    0x54, 0x7B, 0x94, 0x32, 0xA6, 0xC2, 0x23, 0x3D, 0xEE, 0x4C, 0x95, 0x0B, 0x42, 0xFA, 0xC3, 0x4E,
    0x08, 0x2E, 0xA1, 0x66, 0x28, 0xD9, 0x24, 0xB2, 0x76, 0x5B, 0xA2, 0x49, 0x6D, 0x8B, 0xD1, 0x25,
    0x72, 0xF8, 0xF6, 0x64, 0x86, 0x68, 0x98, 0x16, 0xD4, 0xA4, 0x5C, 0xCC, 0x5D, 0x65, 0xB6, 0x92,
    0x6C, 0x70, 0x48, 0x50, 0xFD, 0xED, 0xB9, 0xDA, 0x5E, 0x15, 0x46, 0x57, 0xA7, 0x8D, 0x9D, 0x84,
    0x90, 0xD8, 0xAB, 0x00, 0x8C, 0xBC, 0xD3, 0x0A, 0xF7, 0xE4, 0x58, 0x05, 0xB8, 0xB3, 0x45, 0x06,
    0xD0, 0x2C, 0x1E, 0x8F, 0xCA, 0x3F, 0x0F, 0x02, 0xC1, 0xAF, 0xBD, 0x03, 0x01, 0x13, 0x8A, 0x6B,
    0x3A, 0x91, 0x11, 0x41, 0x4F, 0x67, 0xDC, 0xEA, 0x97, 0xF2, 0xCF, 0xCE, 0xF0, 0xB4, 0xE6, 0x73,
    0x96, 0xAC, 0x74, 0x22, 0xE7, 0xAD, 0x35, 0x85, 0xE2, 0xF9, 0x37, 0xE8, 0x1C, 0x75, 0xDF, 0x6E,
    0x47, 0xF1, 0x1A, 0x71, 0x1D, 0x29, 0xC5, 0x89, 0x6F, 0xB7, 0x62, 0x0E, 0xAA, 0x18, 0xBE, 0x1B,
    0xFC, 0x56, 0x3E, 0x4B, 0xC6, 0xD2, 0x79, 0x20, 0x9A, 0xDB, 0xC0, 0xFE, 0x78, 0xCD, 0x5A, 0xF4,
    0x1F, 0xDD, 0xA8, 0x33, 0x88, 0x07, 0xC7, 0x31, 0xB1, 0x12, 0x10, 0x59, 0x27, 0x80, 0xEC, 0x5F,
    0x60, 0x51, 0x7F, 0xA9, 0x19, 0xB5, 0x4A, 0x0D, 0x2D, 0xE5, 0x7A, 0x9F, 0x93, 0xC9, 0x9C, 0xEF,
    0xA0, 0xE0, 0x3B, 0x4D, 0xAE, 0x2A, 0xF5, 0xB0, 0xC8, 0xEB, 0xBB, 0x3C, 0x83, 0x53, 0x99, 0x61,
    0x17, 0x2B, 0x04, 0x7E, 0xBA, 0x77, 0xD6, 0x26, 0xE1, 0x69, 0x14, 0x63, 0x55, 0x21, 0x0C, 0x7D,
]
const aesRcon = [
    0x8D, 0x01, 0x02, 0x04, 0x08, 0x10, 0x20, 0x40, 0x80, 0x1B, 0x36,
]
class AesCtx {
    roundKey = new Array(176).fill(0)
    iv = new Array(16).fill(0)
}
function aesInitCtx (ctx, key, iv) {
    for (let i = 0; i < 4; i++) {
        ctx.roundKey[(i * 4) + 0] = key[(i * 4) + 0]
        ctx.roundKey[(i * 4) + 1] = key[(i * 4) + 1]
        ctx.roundKey[(i * 4) + 2] = key[(i * 4) + 2]
        ctx.roundKey[(i * 4) + 3] = key[(i * 4) + 3]
    }

    let temp1 = 0
    let temp2 = 0
    let temp3 = [0, 0, 0, 0]
    for (let i = 4; i < 4 * (10 + 1); i++) {
        {
            temp2 = (i - 1) * 4
            temp3[0] = ctx.roundKey[temp2 + 0]
            temp3[1] = ctx.roundKey[temp2 + 1]
            temp3[2] = ctx.roundKey[temp2 + 2]
            temp3[3] = ctx.roundKey[temp2 + 3]
        }

        if (i % 4 == 0) {
            {
                let temp4 = temp3[0]
                temp3[0]  = temp3[1]
                temp3[1]  = temp3[2]
                temp3[2]  = temp3[3]
                temp3[3]  = temp4
            }

            {
                temp3[0] = aesSbox[temp3[0]]
                temp3[1] = aesSbox[temp3[1]]
                temp3[2] = aesSbox[temp3[2]]
                temp3[3] = aesSbox[temp3[3]]
            }

            temp3[0] ^= aesRcon[i / 4]
        }
        
        temp1 = i * 4
        temp2 = (i - 4) * 4
        ctx.roundKey[temp1 + 0] = ctx.roundKey[temp2 + 0] ^ temp3[0]
        ctx.roundKey[temp1 + 1] = ctx.roundKey[temp2 + 1] ^ temp3[1]
        ctx.roundKey[temp1 + 2] = ctx.roundKey[temp2 + 2] ^ temp3[2]
        ctx.roundKey[temp1 + 3] = ctx.roundKey[temp2 + 3] ^ temp3[3]
    }

    ctx.iv = iv
}
function aesAddRoundKey (round, state, roundKey) {
    for (let i = 0; i < 4; i++) {
        for (let j = 0; j < 4; j++) state[i][j] ^= roundKey[(round * 4 * 4) + (i * 4) + j]
    }
}
function aesXorWithIv (buf, bufPtr, iv) {
    for (let i = 0; i < 16; i++) buf[bufPtr + i] ^= iv[i]
}
function aesMultiply (x, y) {
    return (((y & 1) * x) ^
        (((y >> 1) & 1) * aesXTimes(x)) ^
        (((y >> 2) & 1) * aesXTimes(aesXTimes(x))) ^
        (((y >> 3) & 1) * aesXTimes(aesXTimes(aesXTimes(x)))) ^
        (((y >> 4) & 1) * aesXTimes(aesXTimes(aesXTimes(aesXTimes(x))))))
}
function aesXTimes (x) {
    return (((x << 1) & 0xFF) ^ (((x >> 7) & 0b00000001) * 0b00011011))
}

/* ***** DECOMPRESSION ***** */
function gzipDecompress (arrBuf) { // GZIP spec: https://datatracker.ietf.org/doc/html/rfc1952
    let members = []
    let buf = new Uint8Array(arrBuf)
    let pointer = 0
    while (true) {
        if (pointer >= buf.byteLength) break

        // Parse member header
        if (buf[pointer] != 0x1F || buf[pointer + 1] != 0x8B) throw new Error("[GZIP] Invalid data (Member starts with invalid bytes)"); pointer += 2
        let compressionMethod = buf[pointer]; pointer++
        if (compressionMethod >= 0 && compressionMethod <= 7) throw new Error("[GZIP] Invalid data (Member compression method is invalid)") // reserved
        if (compressionMethod != 8) throw new Error("[GZIP] Not implemented (Unknown member compression method)") // DEFLATE
        let flagBits = buf[pointer].toString(2).padStart(8, "0").split("").map(val => val != "0").reverse(); pointer++ // FTEXT, FHCRC, FEXTRA, FNAME, FCOMMENT, reserved, reserved, reserved
        if (flagBits[5] != 0 || flagBits[6] != 0 || flagBits[7] != 0) throw new Error("[GZIP] Invalid data (Member flags contain invalid data)")
        let modificationTime = (buf[pointer + 3] << 24) + (buf[pointer + 2] << 16) + (buf[pointer + 1] << 8) + buf[pointer]; pointer += 4 // Unix
        if (modificationTime == 0) modificationTime = null
        else modificationTime = new Date(modificationTime * 1000)
        let extraFlagBits = buf[pointer].toString(2).padStart(8, "0").split("").map(val => +val).reverse(); pointer++ // ?, ?, max compression, ?, min compression, ?, ?, ?, ?
        let os = buf[pointer]; pointer++ // enum
        if (os == 255) os = null
        else {
            os = ["FAT filesystem", "Amiga", "VMS/OpenVMS", "Unix", "VM/CMS", "Atari TOS", "HPFS filesystem", "Mac", "Z-System", "CP/M", "TOPS-20", "NTFS filesystem", "QDOS", "Acorn RISCOS"][os]
            if (os == undefined) throw new Error("[GZIP] Not implemented (Member OS information is unknown or invalid)")
        }

        let isText = flagBits[0] // FTEXT
        let extraData = null
        if (flagBits[2]) { // FEXTRA
            extraData = {}
            let extraDataLength = (buf[pointer + 1] << 8) + buf[pointer]; pointer += 2
            let extraDataBuf = buf.slice(pointer, pointer + extraDataLength); pointer += extraDataLength
            let extraDataPointer = 0
            while (true) {
                if (extraDataPointer >= extraDataBuf.byteLength) break

                let id1 = extraDataBuf[extraDataPointer]; extraDataPointer++
                let id2 = extraDataBuf[extraDataPointer]; extraDataPointer++
                if (id2 == 0) throw new Error("[GZIP] Invalid data (Member extra data contains invalid data)")
                let type = null
                if (id1 == 0x41 && id2 == 0x70) type = "ApolloFileTypeInfo"
                if (type == null) throw new Error("[GZIP] Not implemented (Member extra data contains unknown data)")
                
                let length = (extraDataBuf[extraDataPointer + 1] << 8) + extraDataBuf[extraDataPointer]; extraDataPointer += 2
                let dataBuf = extraDataBuf.slice(extraDataPointer, extraDataPointer + length); extraDataPointer += length
                extraData[type] = dataBuf.buffer
            }
        }
        let name = null
        if (flagBits[3]) { // FNAME
            let nameNullIndex = buf.indexOf(0x00, pointer)
            let nameBuf = buf.slice(pointer, nameNullIndex); pointer += nameBuf.byteLength + 1
            name = new TextDecoder("iso-8859-1").decode(nameBuf)
        }
        let comment = null
        if (flagBits[4]) { // FCOMMENT
            let commentNullIndex = buf.indexOf(0x00, pointer)
            let commentBuf = buf.slice(pointer, commentNullIndex); pointer += commentBuf.byteLength + 1
            comment = new TextDecoder("iso-8859-1").decode(commentBuf)
        }
        let headerCrc16 = null
        if (flagBits[1]) { // FHCRC
            headerCrc16 = (buf[pointer + 1] << 8) + buf[pointer]; pointer += 2 // The 2 least significant bytes of the CRC32 of the header up to these 2 bytes
            let actualHeaderCrc16 = crc32(buf.slice(0, pointer - 2)) & 0xFFFF
            if (headerCrc16 != actualHeaderCrc16) throw new Error("[GZIP] Invalid data (Header data is invalid)")
        }

        // Parse member data
        let dataBuf = buf.slice(pointer).buffer
        let decompressed = inflate(dataBuf); pointer += decompressed.inputBufPointer // Decompress the data, skip to the end of the compressed data
        let data = decompressed.arrBuf
        if (isText) data = new TextDecoder().decode(new Uint8Array(data))

        // Parse member trailer
        let dataCrc32 = (BigInt(buf[pointer + 3]) << 24n) + (BigInt(buf[pointer + 2]) << 16n) + (BigInt(buf[pointer + 1]) << 8n) + BigInt(buf[pointer]); pointer += 4 // Decompressed data CRC32
        let actualDataCrc32 = crc32(decompressed.arrBuf)
        if (dataCrc32 != actualDataCrc32) throw new Error("[GZIP] Invalid data (Decompressed data is invalid)")
        let decompressedDataSize = (BigInt(buf[pointer + 3]) << 24n) + (BigInt(buf[pointer + 2]) << 16n) + (BigInt(buf[pointer + 1]) << 8n) + BigInt(buf[pointer]); pointer += 4 // Decompressed data size (modulo 2^32)
        if (decompressed.arrBuf.byteLength % 2**32 != decompressedDataSize) throw new Error("[GZIP] Invalid data (Decompressed size does not match expected value)")
        members.push({isText, data, info: {extraData, name, comment, modificationTime, os}})
    }
    return members
}
function inflate (arrBuf) { // DEFLATE spec: https://datatracker.ietf.org/doc/html/rfc1951
    function readBits (count, reverse = false) {
        if (count == 0) return 0

        let totalBytes = Math.ceil((bitPointer + count) / 8)
        let bytes = buf.slice(pointer, pointer + totalBytes).reverse()
        let bits = [...bytes].map(val => val.toString(2).padStart(8, "0")).join("")
        bits = bits.substring(bits.length - bitPointer - count, bits.length - bitPointer)
        if (reverse) bits = bits.split("").reverse().join("")
        let num = parseInt(bits, 2)

        pointer += Math.floor((bitPointer + count) / 8)
        bitPointer = (bitPointer + count) % 8
        return num
    }

    let output = []
    let buf = new Uint8Array(arrBuf)
    let pointer = 0
    let bitPointer = 0
    while (true) {
        if (pointer >= buf.byteLength) throw new Error("[INFLATE] Invalid data (Block did not end properly)")

        // Decompress block
        let isLastBlock = readBits(1) != 0
        let type = readBits(2) // enum - no compression, fixed Huffman codes, dynamic Huffman codes, reserved
        if (type == 3) throw new Error("[INFLATE] Invalid data (Block has invalid type)")
        if (type == 0) { // no compression
            pointer++, bitPointer = 0
            let length = (buf[pointer + 1] << 8) + buf[pointer]; pointer += 2 // The data length
            let lengthOnesComplement = (buf[pointer + 1] << 8) + buf[pointer]; pointer += 2 // One's complement of the data length

            let lengthBits = length.toString(2).padStart(16, "0")
            let lengthBits2 = lengthOnesComplement.toString(2).padStart(16, "0").split("").map(val => val == "0" ? "1" : "0").join("")
            if (lengthBits != lengthBits2) throw new Error("[INFLATE] Invalid data (Non-compressed block length is invalid)")

            let data = buf.slice(pointer, pointer + length); pointer += length // Literal data
            output.push(...data)
        } else {
            let literalLengthHuffmanTree = deflateFixedLiteralLengthHuffmanTree // For static blocks
            let distanceHuffmanTree = deflateFixedDistanceHuffmanTree // For static blocks
            if (type == 2) {
                let numLiteralLengthCodes = readBits(5) + 257
                let numDistanceCodes = readBits(5) + 1
                let numCodeLengthCodes = readBits(4) + 4

                let secondaryCodeLengths = new Array(deflateSecondaryCodeLengthsOrder.length).fill(0) // Decode secondary Huffman tree
                for (let i = 0; i < numCodeLengthCodes; i++) secondaryCodeLengths[deflateSecondaryCodeLengthsOrder[i]] = readBits(3)
                let secondaryHuffmanTree = createHuffmanTreeFromCodeLengths(secondaryCodeLengths)

                let inLengthCodesTemp = [numLiteralLengthCodes, numDistanceCodes] // Decode literal/length Huffman tree and distance Huffman tree
                let outTreesTemp = []
                let codeLengthsTemp = []
                let lastCodeTemp = null
                for (let i = 0; i < inLengthCodesTemp.length; i++) { // Is a loop because the 2 trees are parsed in the same way
                    for (let j = 0; j < inLengthCodesTemp[i]; j++) {
                        let val = decodeHuffmanCode(secondaryHuffmanTree, count => readBits(count, true)) // Decode value
                        if (val == null) throw new Error("[INFLATE] Invalid data (Dynamic block data is compressed invalidly)")
                        if (val <= 15) { // Literal value
                            lastCodeTemp = val
                            codeLengthsTemp.push(val)
                        } else if (val == 16) { // Short value repeat value
                            if (lastCodeTemp == null) throw new Error("[INFLATE] Invalid data (Dynamic block data is ordered invalidly)")
                            let count = readBits(2) + 3
                            codeLengthsTemp.push(...new Array(count).fill(lastCodeTemp))
                            j += count - 1
                        } else if (val == 17) { // Short 0 repeat value
                            lastCodeTemp = 0
                            let count = readBits(3) + 3
                            codeLengthsTemp.push(...new Array(count).fill(lastCodeTemp))
                            j += count - 1
                        } else if (val == 18) { // Long 0 repeat value
                            lastCodeTemp = 0
                            let count = readBits(7) + 11
                            codeLengthsTemp.push(...new Array(count).fill(lastCodeTemp))
                            j += count - 1
                        } else throw new Error("[INFLATE] Invalid data (Dynamic block data is invalid)")
                    }
                    let tree = createHuffmanTreeFromCodeLengths(codeLengthsTemp) // Create tree from code lengths
                    outTreesTemp.push(tree)
                    codeLengthsTemp = []
                }
                lastCodeTemp = null
                literalLengthHuffmanTree = outTreesTemp[0], distanceHuffmanTree = outTreesTemp[1] // Get trees
            }
            while (true) {
                let literalLengthVal = decodeHuffmanCode(literalLengthHuffmanTree, count => readBits(count, true)) // Decode literal/length value
                if (literalLengthVal == null) throw new Error("[INFLATE] Invalid data (Block data is compressed invalidly)")

                if (literalLengthVal <= 255) output.push(literalLengthVal) // Literal value
                else if (literalLengthVal == 256) break // End of block
                else if (literalLengthVal <= 285) { // Length value
                    let length = deflateLiteralLengthTable[literalLengthVal - 257] + readBits(deflateLiteralLengthExtraBitsTable[literalLengthVal - 257]) // Fully decode length value

                    let distanceVal = decodeHuffmanCode(distanceHuffmanTree, count => readBits(count, true)) // Decode distance value
                    if (distanceVal == null) throw new Error("[INFLATE] Invalid data (Block special data is compressed invalidly)")
                    let distance = deflateDistanceTable[distanceVal] + readBits(deflateDistanceExtraBitsTable[distanceVal]) // Fully decode distance value

                    let outputPointer = output.length - distance // Decode LZ77
                    for (let i = 0; i < length; i++) { // Is a loop due to the distance value being able to overlap the current pointer
                        let outputVal = output[outputPointer + i]
                        output.push(outputVal)
                    }
                } else throw new Error("[INFLATE] Invalid data (Block data is invalid)")
            }
        }
        if (isLastBlock) break
    }
    if (bitPointer != 0) pointer++, bitPointer = 0 // Ensure byte alignment
    let outputBuf = new Uint8Array(output).buffer // Make an ArrayBuffer from an Array
    return {arrBuf: outputBuf, inputBufPointer: pointer}
}
const deflateFixedLiteralLengthHuffmanTree = createHuffmanTreeFromCodeLengths([...new Array(144).fill(8), ...new Array(112).fill(9), ...new Array(24).fill(7), ...new Array(8).fill(8)])
const deflateFixedDistanceHuffmanTree = createHuffmanTreeFromCodeLengths([...new Array(32).fill(5)])
const deflateSecondaryCodeLengthsOrder = [16, 17, 18, 0, 8, 7, 9, 6, 10, 5, 11, 4, 12, 3, 13, 2, 14, 1, 15]
const deflateLiteralLengthTable = [3, 4, 5, 6, 7, 8, 9, 10, 11, 13, 15, 17, 19, 23, 27, 31, 35, 43, 51, 59, 67, 83, 99, 115, 131, 163, 195, 227, 258]
const deflateLiteralLengthExtraBitsTable = [0, 0, 0, 0, 0, 0, 0, 0, 1, 1, 1, 1, 2, 2, 2, 2, 3, 3, 3, 3, 4, 4, 4, 4, 5, 5, 5, 5, 0]
const deflateDistanceTable = [1, 2, 3, 4, 5, 7, 9, 13, 17, 25, 33, 49, 65, 97, 129, 193, 257, 385, 513, 769, 1025, 1537, 2049, 3073, 4097, 6145, 8193, 12289, 16385, 24577]
const deflateDistanceExtraBitsTable = [0, 0, 0, 0, 1, 1, 2, 2, 3, 3, 4, 4, 5, 5, 6, 6, 7, 7, 8, 8, 9, 9, 10, 10, 11, 11, 12, 12, 13, 13]
function createHuffmanTreeFromCodeLengths (codeLengths) { // codeLengths is an array of numbers which represent how long each Huffman code should be
    let codes = []
    let maxBits = codeLengths.toSorted((a, b) => b - a)[0]
    let numCodes = new Array(maxBits + 1).fill(0)
    for (let codeLength of codeLengths) numCodes[codeLength]++
    numCodes[0] = 0

    let code = 0
    let next_code = [0]
    for (let bits = 0; bits < maxBits; bits++) {
        code = (code + numCodes[bits]) << 1
        next_code[bits + 1] = code
    }

    for (let i = 0; i < codeLengths.length; i++) {
        let len = codeLengths[i]
        if (len != 0) {
            codes[i] = next_code[len].toString(2).padStart(codeLengths[i], "0")
            next_code[len]++
        }
    }
    return codes
}
function decodeHuffmanCode (tree, readBitsCallback) { // readBitsCallback is passed one argument, holding the number of bits to read (useful for streaming operations)
    let treeMinLength = tree.reduce((acc, val) => val.length < acc ? val.length : acc, Infinity)
    let treeMaxLength = tree.reduce((acc, val) => val.length > acc ? val.length : acc, 0)

    let rawVal = readBitsCallback(treeMinLength).toString(2).padStart(treeMinLength, "0")
    let val = null
    while (true) {
        val = tree.indexOf(rawVal)
        if (val > -1) return val // Found match
        
        if (rawVal.length >= treeMaxLength) return null // Failed to find match
        rawVal += readBitsCallback(1).toString(2) // Get another bit
    }
}
function zipFileDecompress (arrBuf) { // Decompress a .ZIP file (Does not support encryption)
    let structure = {}
    let buf = new Uint8Array(arrBuf)
    let pointer = 0

    // Find and parse the end of central directory record
    pointer = buf.findLastIndex((val, idx) => buf[idx] == 0x50 && buf[idx + 1] == 0x4B && buf[idx + 2] == 0x05 && buf[idx + 3] == 0x06); pointer += 4
    if (pointer == -1 + 4) throw new Error("[UNZIP] Invalid data (Failed to find the correct end of the file)")
    let currentDisk = (buf[pointer + 1] << 8) + buf[pointer]; pointer += 2
    let centralDirStartDisk = (buf[pointer + 1] << 8) + buf[pointer]; pointer += 2
    if (currentDisk != centralDirStartDisk) throw new Error("[UNZIP] Not implemented (Required data is on a different disk)")
    let centralDirRecordCountCurrentDisk = (buf[pointer + 1] << 8) + buf[pointer]; pointer += 2
    let centralDirRecordCount = (buf[pointer + 1] << 8) + buf[pointer]; pointer += 2
    if (centralDirRecordCount != centralDirRecordCountCurrentDisk) throw new Error("[UNZIP] Not implemented (File data is split across multiple disks)")
    let centralDirSize = (buf[pointer + 3] << 24) + (buf[pointer + 2] << 16) + (buf[pointer + 1] << 8) + buf[pointer]; pointer += 4
    let centralDirOffset = (buf[pointer + 3] << 24) + (buf[pointer + 2] << 16) + (buf[pointer + 1] << 8) + buf[pointer]; pointer += 4
    let isZip64 = centralDirOffset == 0xFFFFFFFF
    if (isZip64) throw new Error("[UNZIP] Invalid data (Zip64 format is not supported)")
    let commentLength = (buf[pointer + 1] << 8) + buf[pointer]; pointer += 2
    let commentBuf = buf.slice(pointer, pointer + commentLength); pointer += commentLength
    let comment = new TextDecoder().decode(commentBuf)

    // Parse central directory file headers
    let fileHeaders = []
    pointer = centralDirOffset
    let centralDirBuf = buf.slice(pointer, pointer + centralDirSize)
    for (let i = 0; i < centralDirRecordCount; i++) {
        if (buf[pointer] != 0x50 || buf[pointer + 1] != 0x4B || buf[pointer + 2] != 0x01 || buf[pointer + 3] != 0x02) throw new Error("[UNZIP] Invalid data (Directory file header starts with invalid bytes)"); pointer += 4
        let zipVersion = (buf[pointer + 1] << 8) + buf[pointer]; pointer += 2
        let minUnzipVersion = (buf[pointer + 1] << 8) + buf[pointer]; pointer += 2
        let flagBits = ((buf[pointer + 1] << 8) + buf[pointer]).toString(2).padStart(16, "0").split("").map(val => val != "0").reverse(); pointer += 2
        let compressionMethod = (buf[pointer + 1] << 8) + buf[pointer]; pointer += 2 // 0=None, 8=DEFLATE
        if (compressionMethod != 0 && compressionMethod != 8) throw new Error("[UNZIP] Not implemented (Unknown directory file compression method)")
        let modificationTime = (buf[pointer + 1] << 8) + buf[pointer]; pointer += 2
        let modificationDate = (buf[pointer + 1] << 8) + buf[pointer]; pointer += 2
        let dataCrc32 = (BigInt(buf[pointer + 3]) << 24n) + (BigInt(buf[pointer + 2]) << 16n) + (BigInt(buf[pointer + 1]) << 8n) + BigInt(buf[pointer]); pointer += 4 // Decompressed data CRC32
        let compressedSize = (buf[pointer + 3] << 24) + (buf[pointer + 2] << 16) + (buf[pointer + 1] << 8) + buf[pointer]; pointer += 4
        let decompressedSize = (buf[pointer + 3] << 24) + (buf[pointer + 2] << 16) + (buf[pointer + 1] << 8) + buf[pointer]; pointer += 4
        let nameLength = (buf[pointer + 1] << 8) + buf[pointer]; pointer += 2
        let extraDataLength = (buf[pointer + 1] << 8) + buf[pointer]; pointer += 2
        let commentLength = (buf[pointer + 1] << 8) + buf[pointer]; pointer += 2
        let fileDisk = (buf[pointer + 1] << 8) + buf[pointer]; pointer += 2
        if (fileDisk != currentDisk) throw new Error("[UNZIP] Not implemented (File is on a different disk)")
        let internalFileAttributes = (buf[pointer + 1] << 8) + buf[pointer]; pointer += 2
        let externalFileAttributes = (buf[pointer + 3] << 24) + (buf[pointer + 2] << 16) + (buf[pointer + 1] << 8) + buf[pointer]; pointer += 4
        let localFileHeaderOffset = (buf[pointer + 3] << 24) + (buf[pointer + 2] << 16) + (buf[pointer + 1] << 8) + buf[pointer]; pointer += 4
        let nameBuf = buf.slice(pointer, pointer + nameLength); pointer += nameLength
        let name = new TextDecoder().decode(nameBuf)
        let extraData = buf.slice(pointer, pointer + extraDataLength).buffer; pointer += extraDataLength
        let commentBuf = buf.slice(pointer, pointer + commentLength); pointer += commentLength
        let comment = new TextDecoder().decode(commentBuf)
        fileHeaders.push({comment, internalFileAttributes, externalFileAttributes, localFileHeaderOffset})
    }

    // Parse local file headers
    for (let fileHeader of fileHeaders) {
        pointer = fileHeader.localFileHeaderOffset
        if (buf[pointer] != 0x50 || buf[pointer + 1] != 0x4B || buf[pointer + 2] != 0x03 || buf[pointer + 3] != 0x04) throw new Error("[UNZIP] Invalid data (Local file header starts with invalid bytes)"); pointer += 4
        let minUnzipVersion = (buf[pointer + 1] << 8) + buf[pointer]; pointer += 2
        let flagBits = ((buf[pointer + 1] << 8) + buf[pointer]).toString(2).padStart(16, "0").split("").map(val => val != "0").reverse(); pointer += 2
        let compressionMethod = (buf[pointer + 1] << 8) + buf[pointer]; pointer += 2 // 0=None, 8=DEFLATE
        if (compressionMethod != 0 && compressionMethod != 8) throw new Error("[UNZIP] Not implemented (Unknown local file compression method)")
        let modificationTime = (buf[pointer + 1] << 8) + buf[pointer]; pointer += 2
        let modificationDate = (buf[pointer + 1] << 8) + buf[pointer]; pointer += 2
        let dataCrc32 = (BigInt(buf[pointer + 3]) << 24n) + (BigInt(buf[pointer + 2]) << 16n) + (BigInt(buf[pointer + 1]) << 8n) + BigInt(buf[pointer]); pointer += 4 // Decompressed data CRC32
        let compressedSize = (buf[pointer + 3] << 24) + (buf[pointer + 2] << 16) + (buf[pointer + 1] << 8) + buf[pointer]; pointer += 4
        let decompressedSize = (buf[pointer + 3] << 24) + (buf[pointer + 2] << 16) + (buf[pointer + 1] << 8) + buf[pointer]; pointer += 4
        let nameLength = (buf[pointer + 1] << 8) + buf[pointer]; pointer += 2
        let extraDataLength = (buf[pointer + 1] << 8) + buf[pointer]; pointer += 2
        let nameBuf = buf.slice(pointer, pointer + nameLength); pointer += nameLength
        let name = new TextDecoder().decode(nameBuf)
        let extraData = buf.slice(pointer, pointer + extraDataLength).buffer; pointer += extraDataLength

        let data = null
        if (compressionMethod == 0) data = buf.slice(pointer, pointer + compressedSize).buffer, pointer += compressedSize
        else if (compressionMethod == 8) {
            let compressedData = buf.slice(pointer).buffer

            let decompressed = inflate(compressedData); pointer += decompressed.inputBufPointer // Decompress the data
            data = decompressed.arrBuf
        }
        if (flagBits[3]) { // Additional data descriptor - optional signature, crc32, compressed size, decompressed size
            if (buf[pointer] != 0x50 || buf[pointer + 1] != 0x4B || buf[pointer + 2] != 0x07 || buf[pointer + 3] != 0x08) throw new Error("[UNZIP] Not implemented (Additional data starts with unknown bytes)"); pointer += 4
            dataCrc32 = (BigInt(buf[pointer + 3]) << 24n) + (BigInt(buf[pointer + 2]) << 16n) + (BigInt(buf[pointer + 1]) << 8n) + BigInt(buf[pointer]); pointer += 4 // Decompressed data CRC32
            compressedSize = (buf[pointer + 3] << 24) + (buf[pointer + 2] << 16) + (buf[pointer + 1] << 8) + buf[pointer]; pointer += 4
            decompressedSize = (buf[pointer + 3] << 24) + (buf[pointer + 2] << 16) + (buf[pointer + 1] << 8) + buf[pointer]; pointer += 4
        }

        if (data == null) throw new Error("[UNZIP] Invalid data (Failed to read file data)")
        if (data.byteLength != decompressedSize) throw new Error("[UNZIP] Invalid data (Decompressed data size is invalid)")
        let actualDataCrc32 = crc32(data)
        if (dataCrc32 != actualDataCrc32) throw new Error("[UNZIP] Invalid data (Decompressed data is invalid)")

        // Extract data structure
        let isDir = name.endsWith("/")
        let path = name.split("/")
        if (isDir) path.splice(-1, 1)
        let item = path.splice(-1, 1)[0]

        let currentPath = structure
        for (let pathPart of path) {
            if (currentPath[pathPart] == undefined) currentPath[pathPart] = {}
            currentPath = currentPath[pathPart]
        }
        if (isDir) {
            if (currentPath[item] == undefined) currentPath[item] = {}
        } else currentPath[item] = data
    }

    return structure
}

/* ***** COMPRESSION ***** */
function zipFileCompress (structure) { // Compress a .ZIP file (Does not support encryption) - Note: Not actually using compression
    function exploreStructure (structure, path = "") {
        let keys = Object.keys(structure)
        let names = [].concat(...keys.map(val => structure[val] instanceof ArrayBuffer ? {name: `${path}${val}`, val: structure[val]} : [{name: `${path}${val}/`, val: null}, ...exploreStructure(structure[val], `${path}${val}/`)]))
        return names
    }
    let files = exploreStructure(structure)

    let localFileHeaders = []
    let centralFileHeaders = []
    let tempOffset = 0x00
    for (let file of files) {
        let crc = crc32(file.val), size = file.val?.byteLength ?? 0, nameLen = file.name.length
        let crcArr = [crc & 0xFF, (crc >> 8) & 0xFF, (crc >> 16) & 0xFF, (crc >> 24) & 0xFF], sizeArr = [size & 0xFF, (size >> 8) & 0xFF, (size >> 16) & 0xFF, (size >> 24) & 0xFF]
        let nameLenArr = [nameLen & 0xFF, (nameLen >> 8) & 0xFF]
        localFileHeaders.push([
            0x50, 0x4B, 0x03, 0x04, // magic
            0x14, 0x00, // min extractor version
            0x00, 0x00, 0x00, 0x00, // flags, compression method
            0x00, 0x00, 0x00, 0x00, // last modification time/date
            ...crcArr, // uncompressed data crc32
            ...sizeArr, // compressed data size
            ...sizeArr, // uncompressed data size
            ...nameLenArr, // name length
            0x00, 0x00, // extra data length
            ...new TextEncoder().encode(file.name), // file name
            ...new Uint8Array(file.val ?? 0), // file data
        ])

        let tempOffsetArr = [tempOffset & 0xFF, (tempOffset >> 8) & 0xFF, (tempOffset >> 16) & 0xFF, (tempOffset >> 24) & 0xFF]
        centralFileHeaders.push([
            0x50, 0x4B, 0x01, 0x02, // magic
            0x14, 0x03, 0x14, 0x00, // compressor version, min extractor version
            0x00, 0x00, 0x00, 0x00, // flags, compression method
            0x00, 0x00, 0x00, 0x00, // last modification time/date
            ...crcArr, // uncompressed data crc32
            ...sizeArr, // compressed data size
            ...sizeArr, // uncompressed data size
            ...nameLenArr, // name length
            0x00, 0x00, // extra data length
            0x00, 0x00, // file comment length
            0x00, 0x00, // file data disk
            0x00, 0x00, 0x00, 0x00, 0x00, 0x00, // internal/external file attributes
            ...tempOffsetArr, // offset to local file header from start of file disk
            ...new TextEncoder().encode(file.name), // file name
        ])
        tempOffset += localFileHeaders.at(-1).length
    }

    let centralFileHeadersLengthArr = [centralFileHeaders.length & 0xFF, (centralFileHeaders.length >> 8) & 0xFF]
    let centralHeadersSizeArr = [tempOffset & 0xFF, (tempOffset >> 8) & 0xFF, (tempOffset >> 16) & 0xFF, (tempOffset >> 24) & 0xFF]
    let endRecord = [
        0x50, 0x4B, 0x05, 0x06, // magic
        0x00, 0x00, 0x00, 0x00, // this disk, central headers start disk
        ...centralFileHeadersLengthArr, // number of central headers on this disk
        ...centralFileHeadersLengthArr, // number of central headers
        ...centralHeadersSizeArr, // size of all central headers
        ...centralHeadersSizeArr, // central headers start location
        0x00, 0x00, // comment length
    ]

    let arrBuf = new Uint8Array([
        ...[].concat(...localFileHeaders),
        ...[].concat(...centralFileHeaders),
        ...endRecord,
    ]).buffer
    return arrBuf
}

/* ***** DECOMPRESSION/COMPRESSION ***** */

/* ***** DECODING ***** */
function decodeBase64 (arrBuf, urlMode = false) { // Decode Base64 (The urlMode argument specifies whether certain special characters can be replaced by others automatically)
    let buf = new Uint8Array(arrBuf)
    let outArr = []

    let numbers = [...buf]
    if (urlMode) numbers = numbers.map(val => val == "-".charCodeAt(0) ? "+".charCodeAt(0) : val).map(val => val == "_".charCodeAt(0) ? "/".charCodeAt(0) : val) // Replace certain special characters
    for (let i = 0; i < numbers.length; i++) { // Check for invalid data
        if (base64Table.indexOf(numbers[i]) == -1 && numbers[i] != "=".charCodeAt(0)) throw new Error("[BASE64] Invalid data (Data contains invalid characters)")
    }
    let binStr = numbers.map(val => base64Table.indexOf(val)).filter(val => val > -1).map(val => val.toString(2).padStart(6, "0")).map(val => val.substring(val.length - 6)).join("") // Binary string

    for (let i = 0; i < binStr.length; i += 8) { // Split the binary string
        let bin = binStr.substring(i, i + 8)
        if (bin.length < 8) break // Discard small last group
        outArr.push(parseInt(bin, 2)) // Parse number from binary
    }
    return new Uint8Array(outArr).buffer // Make an ArrayBuffer from an Array
}

/* ***** ENCODING ***** */
function encodeBase64 (arrBuf) { // Encode Base64
    let buf = new Uint8Array(arrBuf)
    let outArr = []
    
    let binStr = [...buf].map(val => val.toString(2).padStart(8, "0")).join("")
    for (let i = 0; i < binStr.length; i += 6) {
        let padding = "0".repeat(Math.max(0, (i + 6) - binStr.length)) // Pad small last group
        let bin = binStr.slice(i, i + 6) + padding
        outArr.push(base64Table[parseInt(bin, 2)]) // Find the character representing the binary string part
    }
    let padding = new Array(4 - ((outArr.length % 4) || 4)).fill(61) // Pad output
    outArr.push(...padding)
    return new Uint8Array(outArr).buffer // Make an ArrayBuffer from an Array
}

/* ***** DECODING/ENCODING ***** */
const base64Table = []
for (let c = 65; c <= 90; c++) base64Table.push(c) // A-Z
for (let c = 97; c <= 122; c++) base64Table.push(c) // a-z
for (let c = 48; c <= 57; c++) base64Table.push(c) // 0-9
base64Table.push(...["+", "/"].map(val => val.charCodeAt(0))) // +,/
function xorWithKey (arrBuf, key) { // XOR
    let buf = new Uint8Array(arrBuf)
    buf = buf.map(val => val ^ key)
    return buf.buffer
}

/* ***** HASHING ***** */
const crc32Table = makeCRC32Table()
function makeCRC32Table () { // Initializes the CRC32 table
    let crc32Table = []
    let temp = null
    for (let i = 0; i < 256; i++) {
        temp = i
        for (let j = 0; j < 8; j++) temp = ((temp & 1) ? (0xEDB88320 ^ (temp >>> 1)) : (temp >>> 1))
        crc32Table[i] = temp
    }
    return crc32Table
}
function crc32 (arrBuf) { // Calculate a CRC32
    let buf = new Uint8Array(arrBuf)
    let out = 0 ^ -1
    for (let i = 0; i < buf.byteLength; i++) out = (out >>> 8) ^ crc32Table[(out ^ buf[i]) & 0xFF]
    return (out ^ -1) >>> 0
}
