let resultBCD = null
let resultNameBCD = null
let inFileTypesBCD = ["bcd"]
let outFileTypeBCD = "bin"
async function decompressFileFromBCD () {
    let file = await importFile(inFileTypesBCD)
    let fileBuf = new FileBuf(file.buf)
    resultBCD = decompressFromBCD(fileBuf)
    resultNameBCD = file.name
}
async function downloadResultBCD () {
    await exportFile(resultBCD, resultNameBCD, outFileTypeBCD)
}
let bcd_courseKeygenTable = [
    0x7AB1C9D2, 0xCA750936, 0x3003E59C, 0xF261014B,
    0x2E25160A, 0xED614811, 0xF1AC6240, 0xD59272CD,
    0xF38549BF, 0x6CF5B327, 0xDA4DB82A, 0x820C435A,
    0xC95609BA, 0x19BE08B0, 0x738E2B81, 0xED3C349A,
    0x045275D1, 0xE0A73635, 0x1DEBF4DA, 0x9924B0DE,
    0x6A1FC367, 0x71970467, 0xFC55ABEB, 0x368D7489,
    0x0CC97D1D, 0x17CC441E, 0x3528D152, 0xD0129B53,
    0xE12A69E9, 0x13D1BDB7, 0x32EAA9ED, 0x42F41D1B,
    0xAEA5F51F, 0x42C5D23C, 0x7CC742ED, 0x723BA5F9,
    0xDE5B99E3, 0x2C0055A4, 0xC38807B4, 0x4C099B61,
    0xC4E4568E, 0x8C29C901, 0xE13B34AC, 0xE7C3F212,
    0xB67EF941, 0x08038965, 0x8AFD1E6A, 0x8E5341A3,
    0xA4C61107, 0xFBAF1418, 0x9B05EF64, 0x3C91734E,
    0x82EC6646, 0xFB19F33E, 0x3BDE6FE2, 0x17A84CCA,
    0xCCDF0CE9, 0x50E4135C, 0xFF2658B2, 0x3780F156,
    0x7D8F5D68, 0x517CBED1, 0x1FCDDF0D, 0x77A58C94,
]
function decompressFromBCD (fileBuf) {
    let header = fileBuf.buf(0x00, 0x10)
        let header_magic1 = header.int(0x00, IntSize.U32, Endian.LITTLE)
            FileBuf.expectVal(header_magic1, 0x01, "Invalid header magic (#1)")
        let header_magic2 = header.int(0x04, IntSize.U16, Endian.LITTLE)
            FileBuf.expectVal(header_magic2, 0x10, "Invalid header magic (#2)")
        let header_magic3 = header.int(0x06, IntSize.U16, Endian.LITTLE)
            FileBuf.expectVal(header_magic3, [0x00, 0x01], "Invalid header magic (#3)")
        let header_mainDecryptedCrc32 = header.int(0x08, IntSize.U32, Endian.LITTLE)
        let header_magic4 = header.str(0x0C, 0x04)
            FileBuf.expectVal(header_magic4, "SCDL", "Invalid header magic (#4)")
    let footer = fileBuf.buf(0x5BFD0, 0x30)
        let footer_iv = footer.arr(0x00, 0x10)
        let footer_rngState = [
            footer.int(0x10, IntSize.U32, Endian.LITTLE),
            footer.int(0x14, IntSize.U32, Endian.LITTLE),
            footer.int(0x18, IntSize.U32, Endian.LITTLE),
            footer.int(0x1C, IntSize.U32, Endian.LITTLE),
        ]
        let footer_mainDecryptedAesCmac = footer.arr(0x20, 0x10) // Unused here. Checks the CRC32 instead
    let main = fileBuf.buf(0x10, 0x5BFC0)
        let main_rng = new bcd_SeadRng(footer_rngState)
        let main_decryptKey = bcd_Enl.createKey(main_rng, bcd_courseKeygenTable, 0x10)
        let main_aesCmacKey = bcd_Enl.createKey(main_rng, bcd_courseKeygenTable, 0x10)
        let main_decrypted = bcd_decryptData(new Uint8Array(main.data), main_decryptKey, footer_iv)
            let main_decryptedCrc32 = crc32(main_decrypted)
                FileBuf.expectVal(main_decryptedCrc32, header_mainDecryptedCrc32, "Invalid checksum for decrypted data")
    return main_decrypted
}
function bcd_decryptData (buf, keyBuf, ivBuf) {
    buf = [...buf], keyBuf = [...keyBuf], ivBuf = [...ivBuf]

    let ctx = new AesCtx()
    aesInitCtx(ctx, keyBuf, ivBuf)
    aesDecrypt(ctx, buf, buf.length)

    return new Uint8Array(buf).buffer
}

// yes i know i could probably implement this better (without a u32 class)
class bcd__u32 {
    arr = new Uint32Array(1)

    constructor (val) { this.val = val }
    get new () { return bcd_u32(this.val) }

    get val () { return BigInt(this.arr[0]) }
    set val (val) { this.arr[0] = Number(val) }

    get out () { return Number(this.val) }
}; function bcd_u32 (val) { return new bcd__u32(val) }

class bcd_SeadRng {
    state = []

    constructor (state) {
        this.state[0] = bcd_u32(state[0])
        this.state[1] = bcd_u32(state[1])
        this.state[2] = bcd_u32(state[2])
        this.state[3] = bcd_u32(state[3])
    }
    
    // Returns a random 32-bit integer
    u32 () {
        let temp = this.state[0].new
        temp.val ^= temp.val << bcd_u32(11).val
        temp.val ^= temp.val >> bcd_u32(8).val
        temp.val ^= this.state[3].val
        temp.val ^= this.state[3].val >> bcd_u32(19).val

        this.state[0] = this.state[1].new
        this.state[1] = this.state[2].new
        this.state[2] = this.state[3].new
        this.state[3] = temp.new
        return temp.out
    }
    
    // Returns a random integer smaller than 'max'
    uint (max) {
        let temp = bcd_u32(this.u32()).val * bcd_u32(max).val // Bigger than a u32
        return bcd_u32(temp >> bcd_u32(32).val).out
    }
}
class bcd_Enl {
    // Generates 4 bytes of the key and returns them as an integer
    static createKeyPart (rand, table) {
        let value = new Uint8Array(4)
        for (let i = 0; i < 4; i++) {
            let index = rand.uint(table.length)
            let shift = rand.uint(4) * 8
            let byte = (table[index] >> shift) & 0xFF
            value[i] = byte
        }
        return value
    }

    // Generates a key with the given random number generator and integer table
    static createKey (rand, table, size) {
        if (size % 4 != 0) throw new Error("Key size must be multiple of 4")
        
        let key = new Uint8Array(size)
        for (let i = 0; i < size / 4; i++) {
            let value = bcd_Enl.createKeyPart(rand, table)
            key[i * 4] = value[3]
            key[(i * 4) + 1] = value[2]
            key[(i * 4) + 2] = value[1]
            key[(i * 4) + 3] = value[0]
        }
        return key
    }
}
