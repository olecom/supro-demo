(function uglify_js_closure(con ,doc ,win ,l10n){
/*
 * two frontend parts: under `node-webkit` (local) and `connectjs` in browser (http)
 * front end: node-webkit part
 */
    if(typeof process != 'undefined'){// `nodejs` runtime inside HTML (native desktop)
        app.process = process
        app.c_p = require('child_process')
        app.tray = { obj: null ,stat: 'show' }
        app.versions = { node: '' ,connectjs: '' }
        app.w = app.backend_check = app.backend_restart = app.backend_terminate = null

        // start local ExtJS 'App'
        check_versions(node_webkit)
        return
    } else {
        throw new Error('Wrong code execution attempt!')
    }
    return

function run_frontend(){
    var fs = require('fs')

    try {
        fs.statSync(app.config.extjs.path.slice(3) + 'ext-all-nw.js')
    } catch(ex){
        throw new Error(l10n.extjsNotFound)
    }

    try {
        (new Function(fs.readFileSync('app_main/app_front_http.js', 'utf8')))()
    } catch(ex){
        throw new Error(
            'ERROR app_main/app_front_http.js\n' +
            l10n.errload_config_read + '\n' + ex.stack
        )
    }
}

function check_versions(cb){
    app.c_p.exec('node --version',
    function(err, stdout){
        if(err){
            con.error("ERROR spawn `node` process: " + err)
            doc.write(l10n.errload_spawn_backend)
            app.w.window.alert(l10n.errload_spawn_backend)
            return
        }
        app.versions.node = stdout.slice(1)

    app.c_p.exec("node -e \"console.log(require('connect').version)\"",
    function(err, stdout){
        if(err){
            con.error("ERROR require('connect'): " + err)
            doc.write(l10n.errload_spawn_backend)
            app.w.window.alert(l10n.errload_spawn_backend)
            return
        }
        app.versions.connectjs = stdout
        if(typeof Ext != 'undefined'){
            App.cfg.backend.versions.connectjs = app.versions.connectjs
            App.cfg.backend.versions.node = app.versions.node
            Ext.globalEvents.fireEvent('updateVersions')
        }
        cb(app, con)// node_webkit(app, con) || spawn_backend(app, true)
    })//connectjs
    })//node.js
}

function node_webkit(app, con){
    //TODO: wrap `uncaughtException` in ExtJS window, add xhr to backend
    app.process.on('uncaughtException' ,function(err){
        con.error('uncaughtException:', err)
        con.error(err.stack)
        app.w.window.alert && alert(l10n.uncaughtException  + err)
        app.w.window.alert = null
    })

    var gui = require('nw.gui')
       ,http = require('http')

    app.w = gui.Window.get()

    app.w.window.extjs_doc = function open_local_extjs_doc(){
        gui.Window.open('http://localhost:3007/extjs/docs/index.html')
    }

    setup_tray(app.tray ,app.w)

    // long xhr pooling gets messages from backend
    load_config(app) && http.get(//TODO: use `agent:false`
        "http://127.0.0.1:" + app.config.backend.ctl_port
        ,backend_is_running
    ).on('error'
        ,backend_ctl_errors
    )
    app.backend_check = check_backend
    app.backend_restart = restart
    app.backend_terminate = terminate
    app.backend_shutdown = shutdown
    return

function backend_is_running(res){
    res.setEncoding('utf8')
    res.on('data', function(chunk){
        var pid = chunk.slice(7).replace(/\n[\s\S]*/g, '')// remove '? pid: '

        app.config.backend.time = new Date
        app.config.backend.msg = l10n.stsBackendPid(pid)
        app.config.backend.pid = pid
        app.config.backend.url = 'http://127.0.0.1:' + app.config.backend.job_port
        app.config.backend.op = l10n.stsCheck

        get_remote_ip()
        con.log('reload just extjs, backend is up and running already')
    })
}

function backend_ctl_errors(e){
    if("ECONNRESET" == e.code){//TODO: use `agent:false` to remove this
        con.log('backend_ctl_errors: prev. backend connection has been reset, ignore')
        return
    }

    if(app.config.extjs){// run setup only first time after ctl check
        spawn_backend(app)
        con.log('backend spawned && extjs load as callback')
        return
    }
    // ignore other errors for now
    con.warn('backend_ctl_errors():')
    con.dir(e)
}

function spawn_backend(app, restart){
// loads `node`+`connect` as separate process and answers on http requests,
// as for this `nw` instance, as for remote clients
// closing `nw` doesn't mean closing backend processing (maybe cfg it?)

    var fs = require('fs')
        ,log
        ,backend

    try {// check and/or create log dir
        if(!fs.statSync(app.config.log).isDirectory()){
            con.error('ERROR log dir is not a directory')
            log = l10n.errload_config_log_not_dir + app.config.log
            doc.write(log)
            app.w.window.alert(log)
            return false
        }
    } catch(ex){
        try {
            fs.mkdirSync(app.config.log)
        } catch(ex) {
            con.error('ERROR log dir:' + (ex = (' ' + app.config.log + '\n' + ex)))
            log = l10n.errload_config_log_mkdir + ex
            doc.write(log)
            app.w.window.alert(log)
            return false
        }
    }

    log = app.config.log +
          app.config.backend.file.replace(/[\\/]/g ,'_') + '.log'

    backend = app.c_p.spawn(
        'node'
        ,[ app.config.backend.file ]
        ,{
             detached: true
            ,env: {
                NODEJS_CONFIG: JSON.stringify(app.config)
            }
            ,stdio: [ 'ignore'
                ,fs.openSync(log ,'a+')
                ,fs.openSync(log ,'a+')
            ]
        }
    )
    if(!backend.pid || backend.exitCode){
        con.error('ERROR spawn backend exit code: ' + backend.exitCode)
        log = l10n.errload_spawn_backend + backend.exitCode
        doc.write(log)
        app.w.window.alert(log)
        return false
    }
    backend.unref()

    app.config.backend.time = new Date
    app.config.backend.msg = l10n.stsBackendPid(backend.pid),
    app.config.backend.pid = backend.pid
    app.config.backend.url = 'http://127.0.0.1:' + app.config.backend.job_port
    app.config.backend.op = l10n.stsStart
    con.log('backend.pid: ' + backend.pid)

    if(restart){
        setTimeout(check_backend, 4321)// restart, wait a bit
    } else {
        check_backend(get_remote_ip, null)// start
    }

    return true
}

function get_remote_ip(){
    app.c_p.exec('ipconfig',
    function(err, stdout){
    var url
        if(!err){// NOTE: RE can be specific to Russian MS Windows
            err = stdout.match(/^[\s\S]*IPv4-[^:]*: ([^\n]*)\n/)
            if(err){
                url = app.config.backend.url
                app.config.backend.url = app.config.backend.url
                   .replace(/127\.0\.0\.1/, err[1])
                if('DIRECT' != gui.App.getProxyForURL(app.config.backend.url)){
                    app.w.window.alert(l10n.via_proxy(app.config.backend.url))
                    app.config.backend.url = url// restore 'localhost'
                }
            }
        }
        run_frontend()
    })
}

function check_backend(check_ok, check_he){
    con.log('check backend port: ' + app.config.backend.ctl_port)
    if(!check_ok && !app.config.backend.pid){// not restart, check if dead
        App.sts(l10n.stsCheck, l10n.stsDead, l10n.stsHE)
        return
    }
    http.get(
        "http://127.0.0.1:" + app.config.backend.ctl_port
        ,check_ok ? check_ok : backend_ctl_alive
    ).on('error'
        ,check_he ? check_he : backend_ctl_dead
    )
}

function backend_ctl_alive(res, callback){
    res.setEncoding('utf8')
    res.on('data', function (chunk){
        var pid = parseInt(chunk.slice(7).replace(/\n[\s\S]*/g, ''), 10)// remove '? pid: '

        if(app.config.backend.pid != pid){
            con.warn('app.config.backend.pid != pid:'+ app.config.backend.pid + ' ' + pid)
            app.config.backend.pid = pid
        }
        App.sts(l10n.stsCheck, pid + ' - ' + l10n.stsAlive, l10n.stsOK)
        if(callback) callback()
    })
}

function backend_ctl_dead(e){
    if(e && "ECONNRESET" == e.code){
        con.log('backend_ctl_dead: prev. backend connection has been reset, ignore')
        return
    }

    con.log('check: backend is dead')

    if('undefined' == typeof App){// init
        win.setTimeout(function backend_init_check(){
            if(app.config.backend.pid)
                app.config.backend.pid = null
            throw new Error(l10n.errload_check_backend)
        }, app.config.backend.init_timeout || 1234)
    } else {// keep UI, if loaded
        App.sts(l10n.stsCheck, l10n.stsAlive, l10n.stsHE)
    }
}

function restart(){
    con.log('restart: check, spawn, check')
    check_backend(check_ok, check_he)

    function check_ok(res){
        backend_ctl_alive(res, request_cmd_exit)
    }

    function check_he(e){
        if(e){
            if(e && "ECONNRESET" == e.code){
                con.log('reload: prev. backend connection has been reset, ignore')
                return
            }
            con.error('check_he(error):')
            con.dir(e)
        }

        if(app.config.backend.pid)
            app.config.backend.pid = null

        App.sts(l10n.stsCheck, l10n.stsAlive, l10n.stsHE)
        App.sts(l10n.stsStart, l10n.stsRestarting, l10n.stsOK)
        con.log('restart: backend is dead; starting new')
        load_config(app) && check_versions(spawn_backend)
    }

    function request_cmd_exit(){
        con.log('request_cmd_exit ctl_port: ' + app.config.backend.ctl_port)
        http.get(
            "http://127.0.0.1:" + app.config.backend.ctl_port + '/cmd_exit'
            ,reload_ok_spawn
        ).on('error' ,check_he)
    }

    function reload_ok_spawn(){
        con.log('reload_ok_spawn()')
        App.sts(l10n.stsStart, l10n.stsRestarting, l10n.stsOK)
        setTimeout(
            function spawn_reloaded_backend(){
                load_config(app) && check_versions(spawn_backend)
            }
            ,2048
        )
    }
}

function shutdown(){
    http.get({
        hostname: '127.0.0.1',
        port: app.config.backend.ctl_port,
        path: '/cmd_exit',
        agent: false
    }, function(res){
        App.sts(l10n.stsShutdown, l10n.stsStopSystem, l10n.stsOK)
        //TODO check if still is up or grep for pid
    }).on('error', function(e){
        con.error("Shutdown error: " + e.message)
        App.sts(l10n.stsShutdown, e.message, l10n.stsOK)
    })
}

function terminate(){
    if(!app.config.backend.pid) return App.sts(
        l10n.stsCheck, l10n.stsKilledAlready, l10n.stsOK
    )

    return http.get(// get current pid
        "http://127.0.0.1:" + app.config.backend.ctl_port
        ,backend_get_current_pid
    ).on('error' ,backend_ctl_killed)

    function backend_get_current_pid(res){
        App.sts(l10n.stsKilling, l10n.stsCheck,l10n.stsOK)

        res.setEncoding('utf8')
        res.on('data'
       ,function(chunk){
            var pid  = chunk.slice(7).replace(/\n[\s\S]*/g, '')// remove '? pid: '
               ,path = app.process.cwd()

            path += path.indexOf('/') ? '/' : '\\'// add OS-specific slash
            if(pid != app.config.backend.pid)
                con.warn('current pid != app.config.backend.pid; kill anyway!'),
            app.config.backend.pid = pid
            app.c_p.exec(
               'wscript terminate.wsf ' + pid,
                defer_request_check_kill
            )
        })
    }
}

function defer_request_check_kill(err){
    var msg = app.config.backend.pid + ' ' + l10n.stsKilling
    if(err){
        con.error(err)
        App.sts(l10n.stsKilling, msg, l10n.stsHE)
        return
    }
    App.sts(l10n.stsKilling, msg, l10n.stsOK)

    setTimeout(
        function send_check_request(){
            http.get(
                "http://127.0.0.1:" + app.config.backend.ctl_port
                ,backend_ctl_not_killed
            ).on('error' ,backend_ctl_killed)
        }
        ,2048
    )
}

function backend_ctl_not_killed(income){
    con.dir(income)
    App.sts(l10n.stsCheck, l10n.stsAlive, l10n.stsHE)
}

function backend_ctl_killed(e){
    if(e && "ECONNRESET" == e.code){
        con.log('backend_ctl_killed: prev. backend connection has been reset, ignore')
        return
    }

    var m, log = 'backend is killed'
    if(app.config.backend.pid){
        app.config.backend.pid = null
        m =  l10n.stsKilled
    } else {
        m = l10n.stsKilledAlready
        log += ' already'
    }
    App.sts(l10n.stsCheck, m, l10n.stsOK)
    con.log(log)
}

function load_config(app){// loaded only by main process -- node-webkit
    var cfg
    var fs = require('fs')

    if((cfg = app.process._nw_app.argv[0])){// cmd line
        cfg = 'config/' + cfg
    } else {// HOME config
        if(app.process.env.HOME){
            cfg = app.process.env.HOME
        } else if(app.process.env.HOMEDRIVE && app.process.env.HOMEPATH){
            cfg = app.process.env.HOMEDRIVE +  app.process.env.HOMEPATH
        }
        cfg = cfg + '/.enjsms.js'//FIXME: app specific part
        try {
            fs.statSync(cfg)
        } catch (ex){
            cfg = null
        }
    }
    if(!cfg)// default
        cfg = 'config/cfg_default.js'

    try {
        app.config = (
            new Function('var config ; return ' +
                          fs.readFileSync(cfg ,'utf8'))
        )()
    } catch(ex){
        con.error('ERROR load_config:' + (cfg = (' ' + cfg + '\n' + ex)))
        cfg = l10n.errload_config_read + cfg
        doc.write(cfg)
        app.w.window.alert(cfg)
        return false
    }

    app.config.backend.time = null
    app.config.backend.versions = {
        node: app.versions.node,
        connectjs: app.versions.connectjs,
        nw: app.process.versions['node-webkit']
    }

    con.log('reading config: ' + cfg + ' done')

    return check_extjs_path()
}

function check_extjs_path(){// find local ExtJS in and above cwd './'
    var fs = require('fs'), pe = '../', d = '', i, p
       ,ef = app.config.backend.extjs.pathFile
       ,extjs_path

    /* lookup extjs.txt first */
    try{
        extjs_path = fs.readFileSync(ef).toString().trim()
    } catch(ex){
        if(app.config.extjs.path){
            extjs_path = app.config.extjs.path
            d += 'c'
        } else {
            ex.message += '\n\n' + l10n.extjsPathNotFound(ef)
            throw ex
        }
    }
    if('/' != extjs_path[extjs_path.length - 1]) extjs_path += '/'

    i = 7
    do {
       try{
            p = fs.statSync(extjs_path)
            fs.writeFileSync(ef, extjs_path)
        } catch(ex){ }
        extjs_path = pe + extjs_path// add final level from `app_main` anyway
        if(p){
            break
        }
    } while(--i)

    while(1){
        if(p){
            d = ''
            break
        }
        if(d){/* no 'extjs.txt' file, and cfg failed */
            d = l10n.extjsPathNotFound(ef, app.config.extjs.path, 1)
            break
        }

        if(app.config.extjs.path){
            extjs_path = app.config.extjs.path
            if('/' != extjs_path[extjs_path.length - 1]) extjs_path += '/'
        } else {/* no `extjs.txt` && no cfg value */
            d = l10n.extjsPathNotFound(ef, app.config.extjs.path, 2)
            break
        }
        i = 7, p = null
        do {
            try{
                p = fs.statSync(extjs_path)
            } catch(ex){ }
            extjs_path = pe + extjs_path
            if(p) break
        } while(--i)
        if(p){
            fs.writeFileSync(ef, extjs_path)
            break
        }
        d = l10n.extjsPathNotFound(ef, app.config.extjs.path)
        break
    }
    if(!d){
        app.config.extjs.path = extjs_path
        con.log('ExtJS path found: "' + extjs_path + '" (for "app_main/app.htm")')
        return true
    }
    con.error('ExtJS path not found')
    doc.getElementById('e').style.display = "block"
    doc.getElementById('d').innerHTML = d.replace(/\n/g, '<br>')
    return false
}

function setup_tray(t ,w){
    t.obj = new gui.Tray({ title: l10n.tray.title ,icon: 'app_main/css/favicon.png' })
    t.obj.tooltip = l10n.tray.winvis

    t.obj.on('click' ,function onTrayClick(){
        if('show' == t.stat){// simple show,focus / hide
            t.stat = 'hide'
            t.obj.tooltip = l10n.tray.wininv
            w.hide()
        } else {
            w.show()
            t.obj.tooltip = l10n.tray.winvis
            t.stat = 'show'
        }
    })
    con.log('setup_tray: done')
}
}// nw

})(console ,document ,window ,l10n)
