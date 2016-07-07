#!/bin/bash

## Stop Flogo Engine
pkill flogo

## Stop State Service
#ps ax | grep 'com.tibco.flogo.ss.service.FlogoServerService' | grep -v grep | awk '{ print "kill " -9 $1 }' | bash
ps ax | grep 'flogo-internal/flow-state-service' | grep -v grep | awk '{ print "kill  -9 " $1 }' | bash

## Stop Flow Service
#ps ax | grep 'com.tibco.flogo.service.FlogoServerService' | grep -v grep | awk '{ print "kill " -9 $1 }' | bash
ps ax | grep 'flogo-internal/flow-service' | grep -v grep | awk '{ print "kill  -9 " $1 }' | bash

## Stop Redis
#eval $(docker-machine env flogo)
docker stop $(docker ps -q -f "name=redis")
docker rm $(docker ps -a -q -f "name=redis")

## Stop Docker
# docker-machine stop flogo