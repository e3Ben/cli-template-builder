const {readFile, readdir, writeFile} = require('fs/promises')
const {existsSync} = require('fs')
const path = require('path')
const Handlebars = require('handlebars')
const commondir = require('commondir')
const {dropLast, pipe, split, filter, join} = require('ramda')

const rootDir = path.parse(process.cwd()).root
const getProjPath = async (dirPath) => {
    const listing = await readdir(dirPath)
    const csproj = listing.find(x => x.match(/^.*\.csproj$/))

    if(csproj !== undefined){
        const projPath = path.resolve(dirPath, csproj)
        return projPath
    }else if(dirPath.trim() === rootDir){
        return null
    }else{
        // recursive
        const parentDirectory = path.resolve(dirPath, '..')
        return await getProjPath(parentDirectory)
    }
}
const getTemplate = async(templateName) => {
    const file = resolvePath('exec', `./templates/${templateName}`)

    if(!existsSync(file))
        throw Error('file does not exist: ' + file)
    
    const fileContents = readFile(file, { encoding: 'utf-8' })
    return fileContents
}
const buildFromTemplate = async(templateName, data) => {
    const templateString = await getTemplate(templateName)
    const template = Handlebars.compile(templateString)
    const result = template(data)

    return result
}
const resolvePath = (relativeTo, filePath) => {
    /**
     * Be careful when moving this method to other files.
     * This method pulls __dirname directly.
     */
    let result = ''

    switch(relativeTo){
        case 'exec':
            result = path.resolve(__dirname, '..', filePath)
            break;
        case 'cwd':
            result = path.resolve(process.cwd(), filePath)
            break;
        default:
            break;
    }

    return result
}
const formNamespaceName = pipe(
    split('/'),
    dropLast(1),
    filter(x => x.trim() !== ''),
    join('.')
)
const dropFileExtension = pipe(
    x => path.basename(x),
    split('.'),
    dropLast(1),
    join('.')
)
const buildCSharpTemplate = async(file_path, templateName) => {
    const file = resolvePath('cwd', file_path)

    if(existsSync(file))
        throw Error('File or directory already exists. Aborting...')

    const projPath = await getProjPath(path.dirname(file))
    if(projPath === null)
        throw Error('File would have no .csproj. Aborting...')
    

    const comDir = commondir([file, projPath]) + '/'
    const subbed = comDir.replaceAll('/', '\\/')
    const projRelPath = file.match('(?<=' + subbed + ').*')[0]

    const projectName = dropFileExtension(projPath)
    const className = dropFileExtension(file)

    const namespaceSuffix = formNamespaceName(projRelPath)
    const namespaceName = namespaceSuffix.trim() === '' 
        ? projectName
        : projectName + '.' + namespaceSuffix

    const result = await buildFromTemplate(templateName, {
        namespace: namespaceName,
        class: className
    })

    writeFile(file, result, { encoding: 'utf-8' })
}
const buildJSTemplate = async(file_path, templateName) => {
    const file = resolvePath('cwd', file_path)

    if(existsSync(file))
        throw Error('File or directory already exists. Aborting...')

    const component_name = dropFileExtension(file)

    const result = await buildFromTemplate(templateName, {
        component_name,
    })

    writeFile(file, result, { encoding: 'utf-8' })
}


module.exports = {
    buildCSharpTemplate,
    buildJSTemplate,
}
