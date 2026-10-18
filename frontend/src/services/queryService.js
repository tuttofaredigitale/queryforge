import api from './api'

export default {
  executeQuery(query) {
    return api.post('/query/execute', { query })
      .then(response => response.data)
  },
  
  getDatabaseStructure() {
    return api.get('/query/structure')
      .then(response => response.data)
  }
}