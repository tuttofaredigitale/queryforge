import { createStore } from 'vuex'
import auth from './modules/auth'
import user from './modules/user'
import query from './modules/query'

export default createStore({
  modules: {
    auth,
    user,
    query
  }
})