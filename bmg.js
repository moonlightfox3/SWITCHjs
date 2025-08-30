let resultBMG = null
let resultNameBMG = null
let inFileTypesBMG = ["bmg"]
let outFileTypeBMG = "csv"
async function decompressFileFromBMG () {
    let file = await importFile(inFileTypesBMG)
    let fileBuf = new FileBuf(file.buf)
    resultBMG = decompressFromBMG(fileBuf)
    resultNameBMG = file.name
}
async function downloadResultBMG () {
    await exportFile(resultBMG, resultNameBMG, outFileTypeBMG)
}
let bmg_idLength = null
let bmg_dat1Offset = null
let bmg_stringEncoding = null
function decompressFromBMG (fileBuf) {
    bmg_idLength = null
    bmg_dat1Offset = null
    bmg_stringEncoding = null

    let numMode = null
    let header = fileBuf.buf(0x00, 0x20)
        let header_name1 = header.str(0x00, 0x04)
            FileBuf.expectVal(header_name1, ["MESG", "GSEM"], "MESG header does not start with 'MESG' or 'GSEM'")
            if (header_name1 == "MESG") numMode = Endian.BIG
            else if (header_name1 == "GSEM") numMode = Endian.LITTLE
        let header_name2 = header.str(0x04, 0x04)
            FileBuf.expectVal(header_name2, (numMode == Endian.BIG ? "bmg1" : "1gmb"), "MESG header does not start with 'bmg1' or '1gmb'")
        let header_flw1Offset = header.int(0x08, IntSize.U32, numMode)
        let header_sectionCount = header.int(0x0C, IntSize.U32, numMode)
            FileBuf.expectVal(header_sectionCount, 0x04, "MESG header states incorrect section count")
        let header_stringEncoding = header.int(0x10, IntSize.U8, numMode)
            let header_stringEncodingName = null
            if (header_stringEncoding == 0x00) header_stringEncodingName = "cp1252"
            else if (header_stringEncoding == 0x01) header_stringEncodingName = "cp1252"
            else if (header_stringEncoding == 0x02) header_stringEncodingName = "utf-16"
            else if (header_stringEncoding == 0x03) header_stringEncodingName = "shift-jis"
            else if (header_stringEncoding == 0x04) header_stringEncodingName = "utf-8"
            bmg_stringEncoding = header_stringEncodingName
        let header_unused = header.int(0x11, 0x15, numMode)
    let sections = fileBuf.buf(0x20, fileBuf.data.byteLength - 0x20)
        let sections_inf1 = bmg_getSection(sections, numMode, 0x00)
            let inf1_messageCount = sections_inf1.section.int(0x00, IntSize.U16, numMode)
            let inf1_idLength = sections_inf1.section.int(0x02, IntSize.U16, numMode)
                bmg_idLength = inf1_idLength
        let sections_dat1 = bmg_getSection(sections, numMode, sections_inf1.endOffset)
            bmg_dat1Offset = sections_inf1.endOffset + 0x20
        let sections_flw1 = bmg_getSection(sections, numMode, header_flw1Offset - 0x20)
        let sections_fli1 = bmg_getSection(sections, numMode, sections_flw1.endOffset)
    let messages = []
        for (let i = 0; i < inf1_messageCount; i++) {
            messages[i] = {
                id: i,
                info: bmg_parseInfo(fileBuf, numMode, i),
                text: bmg_parseText(fileBuf, numMode, i),
            }
        }
    let outText = `"Index:Int:0","MessageInfo:String:0","Message:String:0"\n`
        for (let message of messages) outText += `"${message.id}","${message.info}","${message.text.replaceAll("\"", "\"\"")}"\n`
        let outBuf = new TextEncoder().encode(outText).buffer
    return outBuf
}
function bmg_getSection (fileBuf, numMode, offset) {
    let base = fileBuf.buf(offset, 0x08)
        let base_name = base.str(0x00, 0x04, numMode)
        let base_size = base.int(0x04, IntSize.U32, numMode)
    let section = fileBuf.buf(offset + 0x08, base_size)
    let endOffset = offset + base_size
    return {
        base_name,
        base_size,
        endOffset,
        section,
    }
}
function bmg_parseInfo (fileBuf, numMode, id) {
    let camerashort = fileBuf.int((bmg_idLength * id) + 48 + 4, IntSize.U16, numMode)
    let otherinf = fileBuf.arr((bmg_idLength * id) + 48 + 4 + 2, bmg_idLength - 6)
        let otherinfStr = otherinf.toString()
    return `${camerashort},${otherinfStr}`
}
function bmg_parseText (fileBuf, numMode, id) {
    let text = ""
    let i = 0
    let dataOffset = fileBuf.int((bmg_idLength * id) + 48, IntSize.U32, numMode)
    let charset = fileBuf.str(bmg_dat1Offset + dataOffset + 8, IntSize.U16, numMode)
    while (charset != "\x00\x00") {
        let offset = bmg_dat1Offset + dataOffset + i
        if (charset == "\x00\x1A") {
            let name = "_"
            let idData = fileBuf.buf(offset + 10, 0x02)
                let idData_0 = idData.int(0x00, IntSize.U8, numMode)
                let idData_1 = idData.int(0x01, IntSize.U8, numMode)
            if (idData_1 == 0x01) { // pause
                if (idData_0 == 8) name = fileBuf.int(offset + 12 + 2, IntSize.U16, numMode)
                else name = fileBuf.int(offset + 12, IntSize.U16, numMode)
            } else if (idData_1 == 0x02) { // anim/sound
                name = ""
                for (let j = 2; j < idData_0 - 4; j += 2) name += fileBuf.str(offset + j + 12 + 1, 1)
            } else if (idData_1 == 0x03) { // emoji
                name = fileBuf.int(offset + 12, IntSize.U16, numMode)
            } else if (idData_1 == 0x04) { // size
                name = fileBuf.int(offset + 12, IntSize.U16, numMode)
            } else if (idData_1 == 0x05) { // plumber
                name = Math.round(fileBuf.int(offset + 12, IntSize.U32, numMode) / 256)
            } else if (idData_1 == 0x06 || idData_1 == 0x07) { // number/systext
                let bytes = fileBuf.buf(offset + 12, 0x0A)
                if (numMode == Endian.BIG) name = `${bytes.int(0x01, IntSize.U8, numMode)},${bytes.int(0x09, IntSize.U8, numMode)}`
                else if (numMode == Endian.LITTLE) name = `${bytes.int(0x00, IntSize.U8, numMode)},${bytes.int(0x06, IntSize.U8, numMode)}`
            } else if (idData_1 == 0x09) { // race time
                let arr = fileBuf.arr(offset + 12, IntSize.U16, numMode)
                name = arr.toString()
            } else if (idData_1 == 0xFF) { // color
                name = Math.round(fileBuf.int(offset + 12, IntSize.U32, Endian.BIG) / 256)
            } else FileBuf.expectVal(0, 1, `Unknown escape ID [${idData_0}, ${idData_1}] in message ${id}`)
            let type = bmg_defs.names[idData_1]
            if (bmg_defs[type] != undefined) name = bmg_defs[type][name] || `unknown_${name}`
            text += `<${type}=${name}>`
            i += idData_0
        } else {
            let newCharset = fileBuf.str(offset + 8, 2, numMode, bmg_stringEncoding)
            text += newCharset
            i += 2
        }
        charset = fileBuf.str(bmg_dat1Offset + dataOffset + i + 8, 2, numMode)
    }
    return text
}
let bmg_defs = {
    names: {
        "1": "pause",
        "2": "insetsound",
        "3": "emoji",
        "4": "size",
        "5": "plumber",
        "6": "number",
        "7": "systemtext",
        "9": "racetime",
        "255": "color",
    },

    pause: {
        "1": "pressa",
        "2": "pause2",
        "3": "notification",
        "10": "short",
        "15": "medium",
        "30": "long",
        "60": "verylong",
    },
    emoji: {
        "0": "button_a",
        "1": "button_b",
        "2": "button_c",
        "3": "wiimote",
        "4": "nunchuck",
        "5": "button_1",
        "6": "button_2",
        "7": "powerstar",
        "8": "spindriver",
        "9": "bluestar",
        "10": "pointer_p1",
        "11": "starbit",
        "12": "coconut",
        "13": "bell",
        "14": "rabbit",
        "15": "button_stick",
        "16": "x",
        "17": "coin",
        "18": "mario",
        "19": "button_dpad",
        "20": "chip_blue",
        "21": "chip_yellow",
        "22": "button_home",
        "23": "button_minus",
        "24": "button_plus",
        "25": "button_z",
        "26": "ticostray",
        "27": "grandstar",
        "28": "luigi",
        "29": "pointer_p2",
        "30": "coin_purple",
        "31": "powerstar_green",
        "32": "crown",
        "33": "crosshair",
        "34": "blank",
        "35": "powerstar_red",
        "36": "pointer_grab",
        "37": "pointer_point",
        "38": "pointer_hand",
        "39": "starbit_multi",
        "40": "peach",
        "41": "letter",
        "42": "?1",
        "43": "player",
        "44": "?2",
        "45": "?3",
        "46": "?4",
        "47": "?5",
        "48": "?6",
        "49": "item_1up",
        "50": "item_life",
        "51": "?7",
        "52": "butler",
        "53": "ticocomet",
        "54": "question",
        "55": "?8",
        "56": "?9",
        "57": "?10",
        "58": "?11",
        "59": "?12",
        "60": "?13",
        "61": "?14",
        "62": "?15",
        "63": "?16",
        "64": "?17",
        "65": "?18",
        "66": "?19",
        "67": "?20",
        "68": "?21",
        "69": "?22",
        "70": "?23",
        "71": "?24",
        "72": "?25",
        "73": "?26",
        "74": "?27",
        "75": "?28",
    },
    size: {
        "0": "small",
        "1": "normal",
        "2": "large",
    },
    plumber: {
        "0": "name",
        "1": "yell",
        "2": "stache",
        "256": "?1",
    },
    color: {
        "0": "black",
        "1": "pink",
        "2": "green",
        "3": "blue",
        "4": "yellow",
        "5": "purple",
        "6": "notifpink",
        "7": "lightgreen",
        "8": "lightblue",
        "9": "lightyellow",
        "10": "brightpink",
        "11": "gray",
    },
}
