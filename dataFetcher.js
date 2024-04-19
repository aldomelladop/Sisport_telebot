const axios = require('axios');
const { API_BASE_URL } = require('./config');

const fetchRestrictions = async () => {
    try {
        const response = await axios.post(`${API_BASE_URL}/consultaRestricciones`);
        return response.data.recordsets[0] || [];
    } catch (error) {
        console.error('Error fetching restrictions:', error);
        return [];
    }
}

module.exports = {
    fetchRestrictions
};
