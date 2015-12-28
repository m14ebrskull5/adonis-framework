'use strict'

/* global describe, it, context */
/**
 * adonis-fold
 * Copyright(c) 2015-2015 Harminder Virk
 * MIT Licensed
*/

const Ioc = require('../../').Ioc
const chai = require('chai')
const expect = chai.expect
const path = require('path')

describe('Ioc', function () {
  context('Providers', function () {
    it('should bind namespace to a given closure', function () {
      Ioc.bind('App/Foo', function () {
        return 'bar'
      })
      expect(Ioc.getProviders()['App/Foo'].closure).to.be.a('function')
      expect(Ioc.getProviders()['App/Foo'].closure()).to.equal('bar')
    })

    it('should return an error when closure is not passed to bind method', function () {
      const fn = function () {
        return Ioc.bind('App/Foo', 'bar')
      }
      expect(fn).to.throw(/Invalid arguments/)
    })

    it('should be able to inject other depedencies', function () {
      Ioc.bind('App/Bar', function () {
        return 'bar'
      })
      Ioc.bind('App/Foo', function (app) {
        return app.use('App/Bar')
      })
      expect(Ioc.use('App/Foo')).to.equal('bar')
    })

    it("should add manager with a namespace and it's defination", function () {
      class Foo {
        static extend () {}
      }
      Ioc.manager('App/Foo', Foo)
      expect(Ioc.getManagers()['App/Foo']).deep.equal(Foo)
    })

    it('should throw an error when manager does not have extend method', function () {
      class Foo {
      }
      const fn = function () {
        return Ioc.manager('App/Foo', Foo)
      }
      expect(fn).to.throw(/Incomplete implementation/g)
    })

    it('should be able to fetch binding from ioc container using use method', function () {
      class Foo {
      }
      Ioc.bind('App/Foo', function () {
        return Foo
      })
      expect(Ioc.use('App/Foo')).deep.equal(Foo)
    })

    it('should be able to fetch binding from ioc container with type hinted depedencies', function () {
      class Foo {
        constructor (App_Bar) {
          this.bar = App_Bar
        }
      }
      class Bar {
      }

      Ioc.bind('App/Bar', function () {
        return new Bar()
      })

      Ioc.bind('App/Foo', function (app) {
        return new Foo(app.use('App/Bar'))
      })

      const foo = Ioc.use('App/Foo')
      expect(foo.bar instanceof Bar).to.equal(true)
    })

    it('should be able to bind instances as singleton', function (done) {
      class Foo {
        constructor () {
          this.time = new Date().getTime()
        }
      }
      Ioc.singleton('App/Foo', function () {
        return new Foo()
      })

      const foo1 = Ioc.use('App/Foo')
      setTimeout(function () {
        const foo2 = Ioc.use('App/Foo')
        expect(foo1.time).to.equal(foo2.time)
        done()
      }, 1000)
    })
  })

  context('Autoloading', function () {
    it('should to be able to autoload directory under a given namespace', function () {
      const namespace = 'App'
      const directory = path.join(__dirname, './app')
      Ioc.autoload(namespace, directory)
      expect(Ioc.use('App/Http/routes')).to.equal('routes')
    })

    it('should to throw an error when unable to require file', function () {
      const namespace = 'App'
      const directory = path.join(__dirname, './app')
      Ioc.autoload(namespace, directory)
      const fn = function () {
        return Ioc.use('App/Http/foo')
      }
      expect(fn).to.throw(/Cannot find module/)
    })
  })

  context('Manager', function () {
    it('should to be extend manager instance of a provider', function () {
      class Foo {
        static extend () {}
      }

      class Mongo {
        constructor () {
          this.name = 'mongo'
        }
      }
      Ioc.manager('App/Foo', Foo)

      Ioc.extend('App/Foo', 'mongo', function () {
        return new Mongo()
      })

      expect(Ioc.getExtenders()['App/Foo'][0]).to.be.an('object')
      expect(Ioc.getExtenders()['App/Foo'][0].key).to.equal('mongo')
    })

    it('should extend provider before resolving it', function () {
      class Cache {
        static drivers () {}

        constructor () {
          return this.constructor.drivers.redis
        }

        static extend (key, defination) {
          this.drivers[key] = defination
        }
      }

      class Redis {
      }

      Ioc.manager('App/Cache', Cache)

      Ioc.bind('App/Cache', function () {
        return new Cache()
      })

      Ioc.extend('App/Cache', 'redis', function () {
        return new Redis()
      })

      expect(Ioc.use('App/Cache') instanceof Redis).to.equal(true)
    })

    it('should throw an error when trying to extend provider without a callback', function () {
      const fn = function () {
        return Ioc.extend('App/Cache', 'redis', 'Redis')
      }
      expect(fn).to.throw(/Invalid arguments, extend expects a callback/)
    })
  })

  context('Make', function () {
    it('should make an instance of class when there are no injections', function () {
      class Redis {
      }
      const redis = Ioc.make(Redis)
      expect(redis instanceof Redis).to.equal(true)
    })

    it('should make an instance of class when there are injections to be typhinted from constructor', function () {
      class Foo {
      }
      Ioc.bind('App/Foo', function () {
        return new Foo()
      })
      class Redis {
        constructor (App_Foo) {
          this.foo = App_Foo
        }
      }

      const redis = Ioc.make(Redis)
      expect(redis.foo instanceof Foo).to.equal(true)
    })

    it('should make an instance of class when there are injections injected via inject method', function () {
      class Foo {
      }

      Ioc.bind('App/Foo', function () {
        return new Foo()
      })

      class Redis {

        static get inject () {
          return ['App/Foo']
        }

        constructor (Foo) {
          this.foo = Foo
        }

      }

      const redis = Ioc.make(Redis)
      expect(redis.foo instanceof Foo).to.equal(true)
    })

    it('should be able to make nested classes', function () {
      class Bar {
      }

      Ioc.bind('App/Bar', function () {
        return new Bar()
      })

      class Foo {
        constructor (Bar) {
          this.bar = Bar
        }
      }

      Ioc.bind('App/Foo', function (app) {
        return new Foo(app.use('App/Bar'))
      })

      class Redis {
        static get inject () {
          return ['App/Foo']
        }
        constructor (Foo) {
          this.foo = Foo
        }
      }

      const redis = Ioc.make(Redis)
      expect(redis.foo instanceof Foo).to.equal(true)
      expect(redis.foo.bar instanceof Bar).to.equal(true)
    })

    it('should be able to deep inject classes from autoloaded path', function () {
      Ioc.autoload('App', __dirname + '/app')

      class Foo {
        static get inject () {
          return ['App/Services/Service']
        }
        constructor (Service) {
          this.services = Service
        }
      }

      const foo = Ioc.make(Foo)
      expect(foo.services.bar).to.equal('bar')
      expect(foo.services.baz).to.equal('baz')
    })

    it('should not make anything other then a class', function () {
      const result = Ioc.make({})
      expect(result).deep.equal({})
    })

    it('should make complexed Classes which has multiple dependencies', function () {
      Ioc.autoload('App', path.join(__dirname, './app'))

      class FooProvider {
      }
      Ioc.bind('App/Providers/Foo', function () {
        return new FooProvider()
      })

      const userController = Ioc.make('App/Http/Controllers/UserController')
      expect(userController.foo instanceof FooProvider).to.equal(true)
      expect(userController.time).to.equal('time')
    })

    it('should throw an error, when unable to resolve binding using makeFunc', function () {
      const fn = function () {
        return Ioc.makeFunc('App/Baz.bar')
      }
      expect(fn).to.throw(/Cannot find module/)
    })

    it('should throw an error, when makeFunc string is not properly formatted', function () {
      const fn = function () {
        return Ioc.makeFunc('App/Baz')
      }
      expect(fn).to.throw(/Unable to make/)
    })

    it('should throw an error, when function does not exists on class', function () {
      Ioc.autoload('App', path.join(__dirname, './app'))
      const fn = function () {
        return Ioc.makeFunc('App/Services/Service.hello')
      }
      expect(fn).to.throw(/hello does not exists/)
    })

    it('should return class instance and method using makeFunc method', function () {
      Ioc.autoload('App', path.join(__dirname, './app'))
      const userController = Ioc.makeFunc('App/Http/Controllers/UserController.hello')
      expect(userController.instance[userController.method]()).to.equal('hello world')
    })
  })

  context('Global', function () {
    it('should throw an error, when unable to resolve depedency from ioc container', function () {
      const fn = function () {
        return Ioc.use('Bar')
      }
      expect(fn).to.throw(/Cannot find module/)
    })

    it('should require node module using use function', function () {
      const lodash = Ioc.use('lodash')
      expect(lodash.each).to.be.a('function')
    })

    it('should be able to alias any binding inside ioc container', function () {
      class Foo {
      }
      Ioc.bind('App/Foo', function () {
        return new Foo()
      })
      Ioc.alias('Foo', 'App/Foo')
      expect(Ioc.use('Foo') instanceof Foo).to.equal(true)
    })

    it('should be able to alias binding using an object', function () {
      class Foo {
      }
      Ioc.bind('App/Foo', function () {
        return new Foo()
      })
      Ioc.aliases({'Foo': 'App/Foo'})
      expect(Ioc.use('Foo') instanceof Foo).to.equal(true)
    })

    it('should transform output of a path using it\'s hooks', function () {
      expect(Ioc.use('App/Services/Hook')).to.equal('bar')
    })

    it('should transform output of a path using multiple hooks', function () {
      expect(Ioc.use('App/Services/MultipleHooks')).to.equal('newBar')
    })

    it('should not transform if hook is not a function', function () {
      expect(Ioc.use('App/Services/FakeHook')).to.be.a('function')
    })
  })
})
