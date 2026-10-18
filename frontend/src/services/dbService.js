import api from './api'

export default {
  resetDatabase() {
    return api.post('/db/reset')
      .then(response => response.data)
  }
}