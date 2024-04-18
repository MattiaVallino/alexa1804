
const AWS = require('aws-sdk');
const moment = require('moment-timezone'); // will help us do all the dates math while considering the timezone


const s3SigV4Client = new AWS.S3({
    signatureVersion: 'v4',
    region: process.env.S3_PERSISTENCE_REGION
});

module.exports = {
    
    getS3PreSignedUrl(s3ObjectKey) {
        const bucketName = process.env.S3_PERSISTENCE_BUCKET;
        const s3PreSignedUrl = s3SigV4Client.getSignedUrl('getObject', {
            Bucket: bucketName,
            Key: s3ObjectKey,
            Expires: 60*1 // the Expires is capped for 1 minute
        });
       
        return s3PreSignedUrl;
    },
    getPersistenceAdapter(tableName) {
        // This function is an indirect way to detect if this is part of an Alexa-Hosted skill
        function isAlexaHosted() {
            return process.env.S3_PERSISTENCE_BUCKET;
        }
        if (isAlexaHosted()) {
            const {S3PersistenceAdapter} = require('ask-sdk-s3-persistence-adapter');
            return new S3PersistenceAdapter({ 
                bucketName: process.env.S3_PERSISTENCE_BUCKET
            });
        } 
        /*else {
            // IMPORTANT: don't forget to give DynamoDB access to the role you're using to run this lambda (via IAM policy)
            const {DynamoDbPersistenceAdapter} = require('ask-sdk-dynamodb-persistence-adapter');
            return new DynamoDbPersistenceAdapter({ 
                tableName: tableName || 'intake-care',
                createTable: true
            });
        }*/
    
    },
    

    
    //create reminder weekly
    
    createReminder_w(startTime, endTime, hour, minute, cadence, timezone, locale, message){
        const currentTime = moment().tz(timezone);

        let stringRecurrence =[];
        
        for (let c=0; c < cadence.length; c++)  {
            let rule = "FREQ=WEEKLY;BYHOUR="+hour+";BYMINUTE="+minute+";BYDAY="+cadence[c]+";";
            stringRecurrence.push(rule);
        }
   
       
   
    
        return {
       
            requestTime: "2024-02-26T12:00:00.000",
            trigger: {
              type: 'SCHEDULED_ABSOLUTE',
              timeZoneId : timezone,
              recurrence : {    
               
                
                startDateTime: startTime.format('YYYY-MM-DDTHH:mm:ss'),
              
                endDateTime : endTime.format('YYYY-MM-DDTHH:mm:ss'), 
                recurrenceRules :stringRecurrence
                
              }
            },
            alertInfo: {
              spokenInfo: {
                content: [{
                  locale: locale,
                  text: message
                }],
              },
            },
            pushNotification: {
              status: "ENABLED",
            }
        }

    },
    
    
    
    UpdateReminderBody(newTime, end, timezone, locale,textUpdated,recurrenceRulesUpdated){
        const currentTime = moment().tz(timezone);

 
   
    
        return {
       
            requestTime: "2024-02-26T12:00:00.000",
            trigger: {
              type: 'SCHEDULED_ABSOLUTE',
              timeZoneId : timezone,
              recurrence : {    
               
                
                startDateTime: newTime.format('YYYY-MM-DDTHH:mm:ss'), 
              
                endDateTime : end.format('YYYY-MM-DDTHH:mm:ss'), 
                recurrenceRules :recurrenceRulesUpdated
                
              }
            },
            alertInfo: {
              spokenInfo: {
                content: [{
                  locale: locale,
                  text: textUpdated
                }],
              },
            },
            pushNotification: {
              status: "ENABLED",
            }
        }

    },

        

   
 
}
