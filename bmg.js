let resultBMG = null
let resultNameBMG = null
let inFileTypesBMG = ["bmg"]
let outFileTypeBMG = "csv"
async function decompressFileFromBMG () {
    let file = await importFile(inFileTypesBMG)
    resultBMG = decompressFromBMG(file.buf)
    resultNameBMG = file.name
}
async function downloadResultBMG () {
    await exportFile(resultBMG, resultNameBMG, outFileTypeBMG)
}
let bmg_idLength = null
let bmg_dat1Offset = null
function decompressFromBMG (data) {
    bmg_idLength = null

    let numMode = null
    let header = getBuf(data, 0x00, 0x20)
        let header_name1 = getStr(header, 0x00, 4)
            expectVals(header_name1, ["MESG", "GSEM"], "Invalid file", "MESG header does not start with 'MESG' or 'GSEM'")
            if (header_name1 == "MESG") numMode = "BE"
            else if (header_name1 == "GSEM") numMode = "LE"
        let header_name2 = getStr(header, 0x04, 4)
            expectVal(header_name2, (numMode == "BE" ? "bmg1" : "1gmb"), "Invalid file", "MESG header does not start with 'bmg1' or '1gmb'")
        let header_flw1Offset = getNum(header, 0x08, U32, numMode)
        let header_sectionCount = getNum(header, 0x0C, U32, numMode)
            expectVal(header_sectionCount, 4, "Invalid file", "MESG header states incorrect section count")
        let header_stringEncoding = getNum(header, 0x10, U8, numMode)
            let header_stringEncodingName = null
            if (header_stringEncoding == 0) header_stringEncodingName = "CP1252"
            else if (header_stringEncoding == 1) header_stringEncodingName = "CP1252"
            else if (header_stringEncoding == 2) header_stringEncodingName = "UTF-16"
            else if (header_stringEncoding == 3) header_stringEncodingName = "Shift-JIS"
            else if (header_stringEncoding == 4) header_stringEncodingName = "UTF-8"
        let header_unused = getNum(header, 0x11, U8*15, numMode)
    let sections = getBuf(data, 0x20, data.byteLength - 0x20)
        let sections_inf1 = bmg_getSection(sections, numMode, 0x00)
            let inf1_messageCount = getNum(sections_inf1.section, 0x00, U16, numMode)
            let inf1_idLength = getNum(sections_inf1.section, 0x02, U16, numMode)
                bmg_idLength = inf1_idLength
        let sections_dat1 = bmg_getSection(sections, numMode, sections_inf1.endOffset)
            bmg_dat1Offset = sections_inf1.endOffset + 0x20
        let sections_flw1 = bmg_getSection(sections, numMode, header_flw1Offset - 0x20)
        let sections_fli1 = bmg_getSection(sections, numMode, sections_flw1.endOffset)
    let messages = []
        for (let i = 0; i < inf1_messageCount; i++) {
            messages[i] = {
                id: i,
                info: bmg_parseInfo(data, numMode, i),
                text: bmg_parseText(data, numMode, i),
            }
        }
    let outText = `"Index:Int:0","MessageInfo:String:0","Message:String:0"\n`
        for (let message of messages) outText += `"${message.id}","${message.info}","${message.text.replaceAll("\"", "\"\"")}"\n`
        let outBuf = new TextEncoder().encode(outText).buffer
    return outBuf
}
function bmg_getSection (data, numMode, offset) {
    let base = getBuf(data, offset, 0x08)
        let base_name = getStr(base, 0x00, 0x04, numMode)
        let base_size = getNum(base, 0x04, U32, numMode)
    let section = getBuf(data, offset + 0x08, base_size)
    let endOffset = offset + base_size
    return {
        base_name,
        base_size,
        endOffset,
        section,
    }
}
function bmg_parseInfo (data, numMode, id) {
    let camerashort = getNum(data, (bmg_idLength * id) + 48 + 4, U16, numMode)
    let otherinfBuf = getBuf(data, (bmg_idLength * id) + 48 + 4 + 2, bmg_idLength - 6)
        let otherinf = new Uint8Array(otherinfBuf)
        let otherinfStr = otherinf.toString()
    return `${camerashort},${otherinfStr}`
}
function bmg_parseText (data, numMode, id) {
    let text = ""
    let i = 0
    let dataOffset = getNum(data, (bmg_idLength * id) + 48, U32, numMode)
    let charset = getStr(data, bmg_dat1Offset + dataOffset + 8, 2, numMode)
    while (charset != "\x00\x00") {
        let offset = bmg_dat1Offset + dataOffset + i
        if (charset == "\x00\x1A") {
            let name = "_"
            let idData = getBuf(data, offset + 10, 0x02)
                let idData_0 = getNum(idData, 0x00, U8, numMode)
                let idData_1 = getNum(idData, 0x01, U8, numMode)
            if (idData_1 == 1) {
                // pause
                if (idData_0 == 8) name = getNum(data, offset + 12 + 2, U16, numMode)
                else name = getNum(data, offset + 12, U16, numMode)
            } else if (idData_1 == 2) {
                // anim/sound
                name = ""
                for (let j = 2; j < idData_0 - 4; j += 2) name += getStr(data, offset + j + 12 + 1, 1)
            } else if (idData_1 == 3) {
                // emoji
                name = getNum(data, offset + 12, U16, numMode)
            } else if (idData_1 == 4) {
                // size
                name = getNum(data, offset + 12, U16, numMode)
            } else if (idData_1 == 5) {
                // plumber
                name = Math.round(getNum(data, offset + 12, U32, numMode) / 256)
            } else if (idData_1 == 6 || idData_1 == 7) {
                // number/systext
                let bytes = getBuf(data, offset + 12, 0x0A)
                if (numMode == "BE") name = `${getNum(bytes, 0x01, U8, numMode)},${getNum(bytes, 0x09, U8, numMode)}`
                else if (numMode == "LE") name = `${getNum(bytes, 0x00, U8, numMode)},${getNum(bytes, 0x06, U8, numMode)}`
            } else if (idData_1 == 9) {
                // race time
                let buf = getBuf(data, offset + 12, U16, numMode)
                name = new Uint8Array(buf).toString()
            } else if (idData_1 == 255) {
                // color
                name = Math.round(getNum(data, offset + 12, U32, "BE") / 256)
            } else expectVal(0, 1, "Error reading file", `Unknown escape ID [${idData_0}, ${idData_1}] in message ${id}`)
            let type = bmg_defs.names[idData_1]
            if (bmg_defs[type] != undefined) name = bmg_defs[type][name] || `?${name}`
            text += `<${type}=${name}>`
            i += idData_0
        } else {
            let newCharset = getStr(data, offset + 8, 2, numMode, "utf-16")
            text += newCharset
            i += 2
        }
        charset = getStr(data, bmg_dat1Offset + dataOffset + i + 8, 2, numMode)
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
