function FV(api, cfg){
    var name = '/FV/'
       ,css = '/css' + name + 'css'
       ,app = api.app
       ,csc = api.connect['static']

    app.use(name + 'api', function FV_API(req, res, next){
        if(~req.url.indexOf('INCS')){
            api.connect.sendFile(__dirname + '/api/movesglob_INCS.json', true)(req, res)
            return
        } else if(~req.url.indexOf('MOVI')){
            api.connect.sendFile(__dirname + '/api/movesglob_MOVI.json', true)(req, res)
            return
        } else if(~req.url.indexOf('SELR')){
            api.connect.sendFile(__dirname + '/api/movesglob_SELR.json', true)(req, res)
            return
        }
        api.connect.sendFile(__dirname + '/api/movesglob_ALL.json', true)(req, res)
    })

    api.cfg.extjs.load.requireLaunch.push(name + 'app_front_feedviewer')
    app.use(name, csc(__dirname + '/'))

    api.cfg.extjs.load.css.push(css)
    app.use(css, api.connect.sendFile(__dirname + '/css/css', true))
    app.use('/css' + name, csc(__dirname + '/css/'))
}

module.exports = FV
